import { pool } from './db';
import { toLocal } from './time';

// Recados do bot para a recepcao (tabela contact_requests, criada pelo bot em src/db.js)
export const REASON_LABEL = {
  valores: 'Valores',
  procedimento: 'Procedimento',
  convenio: 'Convênio',
  urgencia: 'Urgência',
  outro: 'Outro',
};

export async function listRequests(clinicId, status) {
  const [rows] = await pool.query(
    `SELECT id, phone, patient_name, reason, details, status, created_at, resolved_at
       FROM contact_requests WHERE clinic_id = ? AND status = ?
      ORDER BY reason = 'urgencia' DESC, created_at ${status === 'open' ? 'ASC' : 'DESC'} LIMIT 200`,
    [clinicId, status]
  );
  return rows.map((r) => {
    const at = toLocal(r.created_at);
    return { ...r, when: `${at.date.split('-').reverse().slice(0, 2).join('/')} ${at.time}` };
  });
}

export async function countOpen(clinicId) {
  if (!clinicId) return 0;
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM contact_requests WHERE clinic_id = ? AND status = 'open'", [clinicId]);
  return Number(total);
}

export async function setRequestStatus(clinicId, id, status) {
  await pool.query(
    `UPDATE contact_requests SET status = ?, resolved_at = ${status === 'done' ? 'UTC_TIMESTAMP()' : 'NULL'} WHERE id = ? AND clinic_id = ?`,
    [status === 'done' ? 'done' : 'open', id, clinicId]
  );
}
