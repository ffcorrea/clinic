const db = require('../db');
const time = require('../lib/time');

// Agenda de cada clinica. Configuracao (settings.schedule), editavel no painel:
//   slotMinutes    - duracao padrao da consulta (procedimento sem duracao propria)
//   minNoticeHours - antecedencia minima para marcar
//   horizonDays    - ate quantos dias a frente o bot pode marcar
//   week           - expediente por dia da semana (0 = domingo ... 6 = sabado), ex: { "1": ["09:00-12:00", "14:00-18:00"] }
//   blockedDates   - dias sem atendimento, ex: ["2026-12-25"]
const DEFAULT_SCHEDULE = {
  slotMinutes: 60,
  minNoticeHours: 2,
  horizonDays: 30,
  week: { 1: ['09:00-18:00'], 2: ['09:00-18:00'], 3: ['09:00-18:00'], 4: ['09:00-18:00'], 5: ['09:00-18:00'], 6: ['09:00-12:00'] },
  blockedDates: [],
};

const MAX_SLOTS = 12;

function withDefaults(schedule = {}) {
  return { ...DEFAULT_SCHEDULE, ...schedule, week: schedule.week || DEFAULT_SCHEDULE.week };
}

// Tratamentos: "Nome" ou { name, minutes } (minutes vazio = duracao padrao)
function serviceList(settings) {
  return (settings?.services || []).map((s) => (typeof s === 'string' ? { name: s, minutes: null } : s));
}

const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Duracao (min) do procedimento pelo nome; sem correspondencia, a duracao padrao
function durationFor(settings, serviceName) {
  const schedule = withDefaults(settings?.schedule);
  const wanted = normalize(serviceName);
  const service = wanted && serviceList(settings).find((s) => normalize(s.name) === wanted);
  return service?.minutes || schedule.slotMinutes;
}

function intervalsOf(schedule, date) {
  if (schedule.blockedDates.includes(date)) return [];
  return (schedule.week[time.weekdayOf(date)] || []).map((range) => range.split('-').map(time.toMinutes));
}

/**
 * Horarios livres de um dia para um procedimento de `duration` minutos. Os horarios seguem a duracao:
 * comeca no inicio do expediente e vai de `duration` em `duration`; ao bater numa consulta marcada,
 * continua do fim dela (sem deixar buraco na agenda).
 * busy: [{ starts_at, ends_at }] (Date); earliest: Date minimo para comecar.
 */
function daySlots(schedule, date, duration, busy = [], earliest = new Date(0)) {
  const slots = [];
  for (const [open, close] of intervalsOf(schedule, date)) {
    let m = open;
    while (m + duration <= close) {
      const startsAt = time.fromLocal(date, time.fromMinutes(m));
      const endsAt = new Date(startsAt.getTime() + duration * 60000);
      const blocking = busy.filter((b) => startsAt < b.ends_at && endsAt > b.starts_at);
      if (blocking.length) {
        // Pula para o fim da consulta que atrapalha (no horario local)
        const lastEnd = new Date(Math.max(...blocking.map((b) => b.ends_at.getTime())));
        const local = time.toLocal(lastEnd);
        if (local.date !== date) break;
        m = Math.max(m + 1, time.toMinutes(local.time));
        continue;
      }
      if (startsAt >= earliest) slots.push(time.fromMinutes(m));
      m += duration;
    }
  }
  return slots;
}

// O procedimento cabe inteiro no expediente do dia, comecando em `slot`?
function fitsInHours(schedule, date, slot, duration) {
  const m = time.toMinutes(slot);
  return intervalsOf(schedule, date).some(([open, close]) => m >= open && m + duration <= close);
}

function bookingWindow(schedule) {
  const now = new Date();
  return {
    earliest: new Date(now.getTime() + schedule.minNoticeHours * 3600 * 1000),
    lastDate: time.addDays(time.toLocal(now).date, schedule.horizonDays),
  };
}

async function busyBetween(conn, clinicId, from, to) {
  const [rows] = await conn.query(
    `SELECT starts_at, ends_at FROM appointments
      WHERE clinic_id = ? AND status = 'scheduled' AND starts_at < ? AND ends_at > ?`,
    [clinicId, to, from]
  );
  return rows;
}

const overlaps = (start, end, busy) => busy.some((b) => start < b.ends_at && end > b.starts_at);

/**
 * Horarios livres entre duas datas locais ('YYYY-MM-DD'), no maximo MAX_SLOTS.
 * period: 'manha' (antes das 12h), 'tarde' (12h em diante) ou vazio.
 * duration: minutos do procedimento (padrao: slotMinutes).
 */
async function freeSlots(clinicId, rawSchedule, fromDate, toDate, period, duration) {
  const schedule = withDefaults(rawSchedule);
  const minutes = duration || schedule.slotMinutes;
  const { earliest, lastDate } = bookingWindow(schedule);
  const today = time.toLocal(new Date()).date;
  const start = fromDate < today ? today : fromDate;
  const end = toDate > lastDate ? lastDate : toDate;
  if (start > end) return [];

  const conn = { query: (sql, params) => db.query(sql, params).then((rows) => [rows]) };
  const busy = await busyBetween(conn, clinicId, time.fromLocal(start, '00:00'), time.fromLocal(time.addDays(end, 1), '00:00'));

  const free = [];
  for (let date = start; date <= end && free.length < MAX_SLOTS; date = time.addDays(date, 1)) {
    for (const slot of daySlots(schedule, date, minutes, busy, earliest)) {
      if (period === 'manha' && time.toMinutes(slot) >= 720) continue;
      if (period === 'tarde' && time.toMinutes(slot) < 720) continue;
      free.push({ date, time: slot, label: time.describe(time.fromLocal(date, slot)) });
      if (free.length >= MAX_SLOTS) break;
    }
  }
  return free;
}

/**
 * Marca um horario para o paciente. Confere de novo, com trava, se o horario existe e esta livre.
 * Retorna { ok: true, appointment } ou { ok: false, reason }.
 */
async function book(clinicId, rawSchedule, { date, time: slot, duration, patientName, phone, service, notes }) {
  const schedule = withDefaults(rawSchedule);
  const minutes = duration || schedule.slotMinutes;
  const { earliest, lastDate } = bookingWindow(schedule);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(slot || '')) {
    return { ok: false, reason: 'data ou hora em formato invalido (use YYYY-MM-DD e HH:MM)' };
  }
  if (!fitsInHours(schedule, date, slot, minutes)) {
    return { ok: false, reason: `esse horario nao faz parte da agenda da clinica (ou o procedimento de ${minutes} min nao cabe nele)` };
  }

  const startsAt = time.fromLocal(date, slot);
  const endsAt = new Date(startsAt.getTime() + minutes * 60000);
  if (startsAt < earliest || date > lastDate) {
    return { ok: false, reason: 'esse horario esta fora do periodo em que e possivel marcar' };
  }

  return db.withLock(`agenda:${clinicId}`, async (conn) => {
    if (overlaps(startsAt, endsAt, await busyBetween(conn, clinicId, startsAt, endsAt))) {
      return { ok: false, reason: 'esse horario acabou de ser ocupado' };
    }
    const [result] = await conn.query(
      `INSERT INTO appointments (clinic_id, patient_name, phone, service, starts_at, ends_at, status, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 'agent', ?)`,
      [clinicId, patientName, phone, service || null, startsAt, endsAt, notes || null]
    );
    return { ok: true, appointment: { id: result.insertId, startsAt, label: time.describe(startsAt) } };
  });
}

// Proximas consultas marcadas do paciente (pelo telefone do WhatsApp)
async function upcoming(clinicId, phone) {
  const rows = await db.query(
    `SELECT id, starts_at, service FROM appointments
      WHERE clinic_id = ? AND phone = ? AND status = 'scheduled' AND starts_at > UTC_TIMESTAMP()
      ORDER BY starts_at LIMIT 5`,
    [clinicId, phone]
  );
  return rows.map((r) => ({ id: r.id, label: time.describe(r.starts_at), service: r.service }));
}

// Cancela uma consulta futura, so se for do proprio paciente
async function cancel(clinicId, phone, id) {
  const result = await db.query(
    `UPDATE appointments SET status = 'cancelled', updated_at = UTC_TIMESTAMP(),
            notes = CONCAT_WS('\n', notes, 'Cancelado pelo paciente via WhatsApp')
      WHERE id = ? AND clinic_id = ? AND phone = ? AND status = 'scheduled' AND starts_at > UTC_TIMESTAMP()`,
    [id, clinicId, phone]
  );
  return result.affectedRows > 0;
}

// Texto do expediente para o prompt, ex: "segunda a sexta, 9h às 18h; sábado, 9h às 12h"
function hoursText(rawSchedule) {
  const schedule = withDefaults(rawSchedule);
  const fmt = (t) => {
    const [h, m] = t.split(':');
    return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
  };
  const describeDay = (d) => (schedule.week[d] || []).map((r) => r.split('-').map(fmt).join(' às ')).join(' e ');

  const groups = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const text = describeDay(d);
    if (!text) continue;
    const last = groups[groups.length - 1];
    if (last && last.text === text && last.days[last.days.length - 1] === (d === 0 ? 6 : d - 1)) last.days.push(d);
    else groups.push({ text, days: [d] });
  }
  if (!groups.length) return 'sem horário de atendimento cadastrado';

  return groups
    .map(({ text, days }) => {
      const names = days.map((d) => time.WEEKDAYS[d]);
      const label = names.length > 2 ? `${names[0]} a ${names[names.length - 1]}` : names.join(' e ');
      return `${label}, ${text}`;
    })
    .join('; ');
}

module.exports = { DEFAULT_SCHEDULE, withDefaults, serviceList, durationFor, freeSlots, book, upcoming, cancel, hoursText, daySlots };
