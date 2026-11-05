import { pool } from './db';
import { isValidCpf, normalizePhone, onlyDigits, phoneKey, pickClient } from './format';
import { isIsoDate, today, toLocal } from './time';

// Cadastro de clientes de cada clinica (tabela clients, criada pelo bot em src/db.js).
// O vinculo com agenda e recados e pelo telefone: phone_key ignora o nono digito e o 55.

const COLUMNS = "id, name, phone, cpf, DATE_FORMAT(birth_date, '%Y-%m-%d') AS birth_date, cep, address, notes, source, created_at";

export async function listClients(clinicId) {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM clients WHERE clinic_id = ? ORDER BY name`, [clinicId]);
  return rows;
}

// Para os formularios (agenda e atendimento)
export async function clientOptions(clinicId) {
  const [rows] = await pool.query('SELECT id, name, phone, phone_key FROM clients WHERE clinic_id = ? ORDER BY name', [clinicId]);
  return rows;
}

export async function getClient(clinicId, id) {
  const [[row]] = await pool.query(`SELECT ${COLUMNS} FROM clients WHERE id = ? AND clinic_id = ?`, [id, clinicId]);
  return row || null;
}

async function forKey(clinicId, key) {
  const [rows] = await pool.query('SELECT id, name, phone FROM clients WHERE clinic_id = ? AND phone_key = ? ORDER BY id', [clinicId, key]);
  return rows;
}

// { telefone: [clientes] } para varios telefones de uma vez (lista de recados)
export async function clientsByPhone(clinicId, phones) {
  const keys = [...new Set(phones.map(phoneKey).filter(Boolean))];
  if (!keys.length) return {};
  const [rows] = await pool.query('SELECT id, name, phone_key FROM clients WHERE clinic_id = ? AND phone_key IN (?) ORDER BY id', [clinicId, keys]);
  return Object.fromEntries(phones.map((phone) => [phone, rows.filter((c) => c.phone_key === phoneKey(phone))]));
}

// Cliente ja cadastrado com este telefone e nome, ou null
export async function findClient(clinicId, { phone, name }) {
  const key = phoneKey(phone);
  return key ? pickClient(await forKey(clinicId, key), name) : null;
}

/**
 * Id do cliente deste telefone e nome. Sem cadastro com esse nome, cria (outra pessoa no mesmo telefone
 * vira outro cliente). Retorna null se nao houver telefone valido ou nome.
 */
export async function resolveClient(clinicId, { phone, name, source = 'manual' }) {
  const key = phoneKey(phone);
  const cleanName = String(name || '').trim();
  if (!key || !cleanName) return null;
  const found = await findClient(clinicId, { phone, name: cleanName });
  if (found) return found.id;
  const [result] = await pool.query('INSERT INTO clients (clinic_id, name, phone, phone_key, source) VALUES (?, ?, ?, ?, ?)', [
    clinicId,
    cleanName,
    normalizePhone(phone),
    key,
    source,
  ]);
  return result.insertId;
}

// Consultas sem cliente com este telefone passam para quem foi cadastrado nele
async function linkAppointments(clinicId, key) {
  const clients = await forKey(clinicId, key);
  const [rows] = await pool.query(
    "SELECT id, phone, patient_name FROM appointments WHERE clinic_id = ? AND client_id IS NULL AND source <> 'block' AND RIGHT(phone, 8) = ?",
    [clinicId, key.slice(-8)]
  );
  for (const row of rows) {
    if (phoneKey(row.phone) !== key) continue;
    const client = pickClient(clients, row.patient_name) || (clients.length === 1 ? clients[0] : null);
    if (client) await pool.query('UPDATE appointments SET client_id = ? WHERE id = ?', [client.id, row.id]);
  }
}

/** Cria clientes a partir das consultas da agenda que ainda nao tem cliente. Retorna quantas vinculou. */
export async function importFromAgenda(clinicId) {
  const [rows] = await pool.query(
    "SELECT id, phone, patient_name FROM appointments WHERE clinic_id = ? AND client_id IS NULL AND source <> 'block' AND phone IS NOT NULL ORDER BY starts_at",
    [clinicId]
  );
  let linked = 0;
  for (const row of rows) {
    const clientId = await resolveClient(clinicId, { phone: row.phone, name: row.patient_name, source: 'import' });
    if (!clientId) continue;
    await pool.query('UPDATE appointments SET client_id = ? WHERE id = ?', [clientId, row.id]);
    linked++;
  }
  return linked;
}

// Consultas do cliente, as mais recentes primeiro
export async function clientAppointments(clinicId, clientId) {
  const [rows] = await pool.query(
    'SELECT id, service, starts_at, status, source FROM appointments WHERE clinic_id = ? AND client_id = ? ORDER BY starts_at DESC LIMIT 50',
    [clinicId, clientId]
  );
  return rows.map((r) => ({ ...r, ...toLocal(r.starts_at) }));
}

/** Le e valida o formulario. Retorna { data } ou { error }. */
export function parseClientForm(form) {
  const text = (name) => String(form.get(name) || '').trim();
  const name = text('name');
  const phone = normalizePhone(text('phone'));
  const cpf = onlyDigits(text('cpf')) || null;
  const birthDate = text('birth_date') || null;
  const cep = text('cep') || null;

  if (!name) return { error: 'Informe o nome do cliente.' };
  if (phone.length < 10 || phone.length > 15) return { error: 'Informe um telefone válido com DDD.' };
  if (cpf && !isValidCpf(cpf)) return { error: 'CPF inválido. Confira os números.' };
  if (birthDate && (!isIsoDate(birthDate) || birthDate > today())) return { error: 'Data de nascimento inválida.' };
  if (cep && onlyDigits(cep).length !== 8) return { error: 'O CEP deve ter 8 dígitos.' };

  return { data: { name, phone, cpf, birthDate, cep, address: text('address') || null, notes: text('notes') || null } };
}

/** Grava o cliente (id vazio = novo). Retorna { id } ou { error }. */
export async function saveClient(clinicId, id, data) {
  const key = phoneKey(data.phone);
  const twin = pickExact(await forKey(clinicId, key), data.name, id);
  if (twin) return { error: `Já existe ${twin.name} com este telefone.` };

  const values = [data.name, data.phone, key, data.cpf, data.birthDate, data.cep, data.address, data.notes];
  try {
    if (id) {
      const [result] = await pool.query(
        `UPDATE clients SET name = ?, phone = ?, phone_key = ?, cpf = ?, birth_date = ?, cep = ?, address = ?, notes = ?,
                updated_at = UTC_TIMESTAMP()
          WHERE id = ? AND clinic_id = ?`,
        [...values, id, clinicId]
      );
      if (!result.affectedRows) return { error: 'Cliente não encontrado.' };
    } else {
      const [result] = await pool.query(
        'INSERT INTO clients (name, phone, phone_key, cpf, birth_date, cep, address, notes, clinic_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [...values, clinicId]
      );
      id = result.insertId;
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return { error: 'Já existe um cliente com este CPF.' };
    throw error;
  }
  await linkAppointments(clinicId, key);
  return { id };
}

const pickExact = (clients, name, ignoreId) =>
  clients.find((c) => c.id !== ignoreId && c.name.trim().toLowerCase() === name.toLowerCase());
