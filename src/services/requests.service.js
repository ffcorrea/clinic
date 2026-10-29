const db = require('../db');

// Recados do bot para a recepcao: o que o bot nao resolve sozinho (valores, procedimento fora da lista,
// convenio, urgencia...). Aparecem no painel em /painel/recados.
const REASONS = ['valores', 'procedimento', 'convenio', 'urgencia', 'outro'];

/**
 * Registra um recado. Se ja houver um recado aberto do mesmo paciente com o mesmo motivo, acrescenta
 * o detalhe nele (evita duplicar quando o paciente repete a pergunta).
 */
async function create(clinicId, { phone, patientName, reason, details }) {
  const motivo = REASONS.includes(reason) ? reason : 'outro';
  const [open] = await db.query(
    "SELECT id, details FROM contact_requests WHERE clinic_id = ? AND phone = ? AND reason = ? AND status = 'open' LIMIT 1",
    [clinicId, phone, motivo]
  );
  if (open) {
    const merged = [open.details, details].filter(Boolean).join('\n');
    await db.query('UPDATE contact_requests SET details = ?, patient_name = COALESCE(?, patient_name) WHERE id = ?', [
      merged,
      patientName || null,
      open.id,
    ]);
    return { id: open.id, existing: true };
  }
  const result = await db.query(
    'INSERT INTO contact_requests (clinic_id, phone, patient_name, reason, details) VALUES (?, ?, ?, ?, ?)',
    [clinicId, phone, patientName || null, motivo, details || null]
  );
  return { id: result.insertId, existing: false };
}

module.exports = { REASONS, create };
