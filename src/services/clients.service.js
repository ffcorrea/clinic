const db = require('../db');

// Cadastro de clientes pelo lado do bot: acha ou cria o cliente pelo telefone do WhatsApp.
// O cadastro em si fica no painel (dashboard/lib/clients.js; manter as regras em sincronia).

// Mesma regra de dashboard/lib/format.js. Id interno do WhatsApp (ex: "123@lid") nao e telefone.
function normalizePhone(value) {
  const text = String(value || '');
  if (text.includes('@')) return '';
  const digits = text.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

// O WhatsApp pode trazer celular brasileiro com ou sem o nono digito: compara DDI + DDD + 8 ultimos
function phoneKey(value) {
  const digits = normalizePhone(value);
  return /^55\d{10,11}$/.test(digits) ? `${digits.slice(0, 4)}${digits.slice(-8)}` : digits;
}

const normalizeName = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Quem desta lista tem esse nome? Nome igual ou, se nao houver, mesmo primeiro nome ("Maria" = "Maria Silva")
function pickClient(list, name) {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  const first = wanted.split(/\s+/)[0];
  return (
    list.find((c) => normalizeName(c.name) === wanted) ||
    list.find((c) => normalizeName(c.name).split(/\s+/)[0] === first) ||
    null
  );
}

// Clientes cadastrados com este telefone (mais de um quando a familia usa o mesmo WhatsApp)
async function forPhone(clinicId, phone) {
  const key = phoneKey(phone);
  if (!key) return [];
  return db.query('SELECT id, name FROM clients WHERE clinic_id = ? AND phone_key = ? ORDER BY id', [clinicId, key]);
}

/**
 * Id do cliente deste telefone e nome. Sem cadastro com esse nome, cria (outra pessoa no mesmo telefone
 * vira outro cliente). Retorna null se nao houver telefone valido ou nome.
 */
async function resolve(clinicId, { phone, name }) {
  const key = phoneKey(phone);
  const cleanName = String(name || '').trim();
  if (!key || !cleanName) return null;
  const found = pickClient(await forPhone(clinicId, phone), cleanName);
  if (found) return found.id;
  const result = await db.query(
    "INSERT INTO clients (clinic_id, name, phone, phone_key, source) VALUES (?, ?, ?, ?, 'agent')",
    [clinicId, cleanName, normalizePhone(phone), key]
  );
  return result.insertId;
}

module.exports = { forPhone, resolve };
