import { durationFor } from './clinics';
import { pool } from './db';
import { fromLocal, isIsoDate, isTime, toLocal } from './time';

export const STATUSES = {
  scheduled: 'Agendado',
  done: 'Compareceu',
  no_show: 'Faltou',
  cancelled: 'Cancelado',
};

// Consultas entre duas datas locais (inclusive), com data/hora ja no horario de Brasilia
export async function listAppointments(clinicId, fromDate, toDate) {
  const [rows] = await pool.query(
    `SELECT id, patient_name, phone, service, starts_at, ends_at, status, source, notes
       FROM appointments
      WHERE clinic_id = ? AND starts_at >= ? AND starts_at < ?
      ORDER BY starts_at`,
    [clinicId, fromLocal(fromDate, '00:00'), fromLocal(toDate, '23:59')]
  );
  return rows.map((r) => ({
    ...r,
    date: toLocal(r.starts_at).date,
    start: toLocal(r.starts_at).time,
    end: toLocal(r.ends_at).time,
  }));
}

export async function getAppointment(clinicId, id) {
  const [[row]] = await pool.query('SELECT * FROM appointments WHERE id = ? AND clinic_id = ?', [id, clinicId]);
  if (!row) return null;
  const start = toLocal(row.starts_at);
  return { ...row, date: start.date, start: start.time, duration: Math.round((row.ends_at - row.starts_at) / 60000) };
}

/**
 * Le e valida o formulario. Retorna { data } ou { error }.
 * Duracao em branco = a do procedimento escolhido (ou a padrao da clinica).
 */
export function parseAppointmentForm(form, settings) {
  const date = String(form.get('date') || '');
  const start = String(form.get('start') || '');
  const service = String(form.get('service') || '').trim();
  const durationText = String(form.get('duration') || '').trim();
  const duration = durationText ? Number(durationText) : durationFor(settings, service);
  const patientName = String(form.get('patient_name') || '').trim();
  const phone = String(form.get('phone') || '').replace(/\D/g, '');

  if (!isIsoDate(date) || !isTime(start)) return { error: 'Informe data e horário.' };
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) return { error: 'Duração inválida.' };
  if (!patientName) return { error: 'Informe o nome do paciente.' };

  const startsAt = fromLocal(date, start);
  return {
    data: {
      patientName,
      phone: phone || null,
      service: service || null,
      notes: String(form.get('notes') || '').trim() || null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + duration * 60000),
    },
  };
}

// Ha outra consulta agendada no mesmo horario? (ignora a propria, ao editar)
async function conflict(conn, clinicId, { startsAt, endsAt }, ignoreId = 0) {
  const [[row]] = await conn.query(
    `SELECT patient_name, starts_at FROM appointments
      WHERE clinic_id = ? AND status = 'scheduled' AND id <> ? AND starts_at < ? AND ends_at > ? LIMIT 1`,
    [clinicId, ignoreId, endsAt, startsAt]
  );
  return row ? `Conflito com a consulta de ${row.patient_name} às ${toLocal(row.starts_at).time}.` : null;
}

// Mesma trava do bot (src/services/agenda.service.js), para nao marcar dois no mesmo horario
async function withLock(clinicId, fn) {
  const conn = await pool.getConnection();
  try {
    const [[{ locked }]] = await conn.query('SELECT GET_LOCK(?, 10) AS locked', [`agenda:${clinicId}`]);
    if (!locked) return 'Agenda ocupada, tente de novo.';
    try {
      return await fn(conn);
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [`agenda:${clinicId}`]);
    }
  } finally {
    conn.release();
  }
}

/** Retorna mensagem de erro, ou null se gravou. */
export function createAppointment(clinicId, data) {
  return withLock(clinicId, async (conn) => {
    const problem = await conflict(conn, clinicId, data);
    if (problem) return problem;
    await conn.query(
      `INSERT INTO appointments (clinic_id, patient_name, phone, service, starts_at, ends_at, status, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 'manual', ?)`,
      [clinicId, data.patientName, data.phone, data.service, data.startsAt, data.endsAt, data.notes]
    );
    return null;
  });
}

export function updateAppointment(clinicId, id, data) {
  return withLock(clinicId, async (conn) => {
    const problem = await conflict(conn, clinicId, data, id);
    if (problem) return problem;
    await conn.query(
      `UPDATE appointments SET patient_name = ?, phone = ?, service = ?, starts_at = ?, ends_at = ?, notes = ?,
              updated_at = UTC_TIMESTAMP()
        WHERE id = ? AND clinic_id = ?`,
      [data.patientName, data.phone, data.service, data.startsAt, data.endsAt, data.notes, id, clinicId]
    );
    return null;
  });
}

/** Muda o status. Reativar (scheduled) confere conflito. Retorna mensagem de erro, ou null. */
export async function setStatus(clinicId, id, status) {
  if (!STATUSES[status]) return 'Status inválido.';
  const update = (conn) =>
    conn.query('UPDATE appointments SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND clinic_id = ?', [status, id, clinicId]);

  if (status !== 'scheduled') {
    await update(pool);
    return null;
  }
  return withLock(clinicId, async (conn) => {
    const [[row]] = await conn.query('SELECT starts_at, ends_at FROM appointments WHERE id = ? AND clinic_id = ?', [id, clinicId]);
    if (!row) return 'Agendamento não encontrado.';
    const problem = await conflict(conn, clinicId, { startsAt: row.starts_at, endsAt: row.ends_at }, id);
    if (problem) return problem;
    await update(conn);
    return null;
  });
}
