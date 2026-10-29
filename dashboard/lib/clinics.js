import { pool } from './db';
import { decrypt, encrypt } from './secret-box';
import { isIsoDate, isTime } from './time';

// Tipos de clinica = modelos de prompt em src/prompts/<tipo>.md (manter em sincronia)
export const CLINIC_TYPES = [
  { id: 'odontologica', label: 'Odontológica' },
  { id: 'medica', label: 'Médica' },
  { id: 'nutricao', label: 'Nutrição' },
];

export async function listClinics() {
  const [rows] = await pool.query('SELECT id, name FROM clinics ORDER BY name');
  return rows;
}

export async function getClinic(id) {
  const [[row]] = await pool.query('SELECT id, name, type, settings, updated_at FROM clinics WHERE id = ?', [id]);
  return row || null;
}

// Tratamentos: "Nome" ou { name, minutes } (minutes vazio = duracao padrao). Mesmo formato do bot.
export function serviceList(settings) {
  return (settings?.services || []).map((s) => (typeof s === 'string' ? { name: s, minutes: null } : s));
}

const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Duracao (min) do procedimento pelo nome; sem correspondencia, a duracao padrao
export function durationFor(settings, serviceName) {
  const wanted = normalize(serviceName);
  const service = wanted && serviceList(settings).find((s) => normalize(s.name) === wanted);
  return service?.minutes || settings?.schedule?.slotMinutes || 60;
}

// Linhas do formulario: "Clareamento dental | 90" (sem "| minutos" = duracao padrao)
export function servicesToText(settings) {
  return serviceList(settings).map((s) => (s.minutes ? `${s.name} | ${s.minutes}` : s.name)).join('\n');
}

/** Tratamentos do formulario (tabela service_name/service_minutes). Retorna { services } ou { error }. */
export function parseServices(form) {
  // Tabela: service_name[] + service_minutes[]; formato antigo: textarea "Nome | minutos"
  const names = form.getAll('service_name');
  const serviceLines = names.length
    ? names
        .map((n, i) => [String(n).trim(), String(form.getAll('service_minutes')[i] ?? '').trim()])
        .filter(([n, m]) => n || m)
        .map(([n, m]) => (m ? `${n} | ${m}` : n))
    : lines(form.get('services'));

  if (!serviceLines.length) return { error: 'Informe pelo menos um tratamento ou serviço.' };
  const services = [];
  for (const line of serviceLines) {
    const [name, minutesText] = line.split('|').map((part) => part.trim());
    if (!name) return { error: 'Há um tratamento com duração mas sem nome.' };
    if (minutesText === undefined || minutesText === '') {
      services.push({ name, minutes: null });
      continue;
    }
    const minutes = Number(minutesText);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) {
      return { error: `Duração inválida em "${name}": use minutos inteiros entre 5 e 600.` };
    }
    services.push({ name, minutes });
  }
  return { services };
}

const lines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

/** Nome, tipo, profissional e Instagram (comuns a configuracao e nova clinica). Retorna { profile } ou { error }. */
function parseBasics(form) {
  const name = String(form.get('name') || '').trim();
  const type = String(form.get('type') || '');
  const professional = String(form.get('professional') || '').trim();
  const instagram = String(form.get('instagram') || '').trim();
  if (!name) return { error: 'Informe o nome da clínica.' };
  if (!CLINIC_TYPES.some((t) => t.id === type)) return { error: 'Escolha o tipo da clínica.' };
  if (!professional) return { error: 'Informe como o bot se refere ao profissional (ex: "a Dra. Glaucia").' };
  if (!instagram) return { error: 'Informe o Instagram.' };
  const { services, error } = parseServices(form);
  if (error) return { error };
  return { profile: { name, type, professional, instagram, services } };
}

/**
 * Le e valida o formulario de configuracao. Retorna { profile } ou { error }.
 * Expediente por dia: "09:00-12:00, 14:00-18:00" (vazio = fechado).
 */
export function parseConfigForm(form) {
  const basics = parseBasics(form);
  if (basics.error) return basics;
  const { name, type, professional, instagram, services } = basics.profile;
  const notes = lines(form.get('notes'));
  const blockedDates = lines(form.get('blockedDates'));
  const slotMinutes = Number(form.get('slotMinutes'));
  const minNoticeHours = Number(form.get('minNoticeHours'));
  const horizonDays = Number(form.get('horizonDays'));

  if (!Number.isInteger(slotMinutes) || slotMinutes < 10 || slotMinutes > 480) return { error: 'Duração da consulta deve ser entre 10 e 480 minutos.' };
  if (!Number.isInteger(minNoticeHours) || minNoticeHours < 0 || minNoticeHours > 720) return { error: 'Antecedência mínima inválida.' };
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 365) return { error: 'Dias à frente deve ser entre 1 e 365.' };
  const badDate = blockedDates.find((d) => !isIsoDate(d));
  if (badDate) return { error: `Data bloqueada inválida: "${badDate}" (use AAAA-MM-DD).` };

  const week = {};
  for (let day = 0; day < 7; day++) {
    const raw = String(form.get(`week${day}`) || '').trim();
    if (!raw) continue;
    const ranges = raw.split(',').map((r) => r.trim().replace(/\s/g, ''));
    for (const range of ranges) {
      const [start, end] = range.split('-');
      if (!isTime(start) || !isTime(end) || start >= end) {
        return { error: `Horário inválido: "${range}". Use o formato 09:00-12:00, separando intervalos por vírgula.` };
      }
    }
    week[day] = ranges;
  }

  return {
    profile: {
      name,
      type,
      settings: {
        professional,
        services,
        instagram,
        notes,
        schedule: { slotMinutes, minNoticeHours, horizonDays, week, blockedDates },
      },
    },
  };
}

export async function saveClinic(id, { name, type, settings }) {
  await pool.query('UPDATE clinics SET name = ?, type = ?, settings = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [
    name,
    type,
    JSON.stringify(settings),
    id,
  ]);
}

// ---- Cadastro de clinicas (admin) ----

// Agenda inicial de uma clinica nova (mesmo padrao do bot, src/services/agenda.service.js)
export const DEFAULT_SCHEDULE = {
  slotMinutes: 60,
  minNoticeHours: 2,
  horizonDays: 30,
  week: { 1: ['09:00-18:00'], 2: ['09:00-18:00'], 3: ['09:00-18:00'], 4: ['09:00-18:00'], 5: ['09:00-18:00'], 6: ['09:00-12:00'] },
  blockedDates: [],
};

// "Instituto Lírium" -> "instituto-lirium" (vai na URL do webhook)
export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export async function listClinicsAdmin() {
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.type, c.active, c.zapi_instance_id IS NOT NULL AS has_whatsapp,
            (SELECT COUNT(*) FROM users u WHERE u.clinic_id = c.id AND u.active = 1) AS users
       FROM clinics c ORDER BY c.active DESC, c.name`
  );
  return rows;
}

/** Credenciais da Z-API de uma clinica cadastrada no painel, ou null (clinica do .env ou sem WhatsApp). */
export async function getCredentials(id) {
  const [[row]] = await pool.query('SELECT zapi_instance_id, zapi_token, zapi_client_token FROM clinics WHERE id = ?', [id]);
  if (!row?.zapi_instance_id || !row.zapi_token || !row.zapi_client_token) return null;
  return { instanceId: row.zapi_instance_id, token: decrypt(row.zapi_token), clientToken: decrypt(row.zapi_client_token) };
}

/** Le o formulario de nova clinica. Retorna { clinic } ou { error }. */
export function parseNewClinicForm(form) {
  const basics = parseBasics(form);
  if (basics.error) return basics;
  const id = slugify(form.get('id') || basics.profile.name);
  if (id.length < 2) return { error: 'Identificador inválido: use letras, números e hífen.' };
  const whatsapp = parseWhatsapp(form, { required: false });
  if (whatsapp.error) return whatsapp;
  const { name, type, professional, instagram, services } = basics.profile;
  return {
    clinic: {
      id,
      name,
      type,
      settings: { professional, services, instagram, notes: [], schedule: DEFAULT_SCHEDULE },
      whatsapp: whatsapp.credentials,
    },
  };
}

/** Credenciais do formulario. Campos de token em branco = manter os atuais. */
export function parseWhatsapp(form, { required }) {
  const instanceId = String(form.get('zapi_instance_id') || '').trim();
  const token = String(form.get('zapi_token') || '').trim();
  const clientToken = String(form.get('zapi_client_token') || '').trim();
  if (!instanceId && !token && !clientToken) {
    return required ? { error: 'Informe as credenciais da Z-API.' } : { credentials: null };
  }
  if (!instanceId) return { error: 'Informe o ID da instância da Z-API.' };
  return { credentials: { instanceId, token, clientToken } };
}

/** Retorna mensagem de erro, ou null. */
export async function createClinic({ id, name, type, settings, whatsapp }) {
  if (whatsapp && (!whatsapp.token || !whatsapp.clientToken)) return 'Informe também o token e o Client-Token da Z-API (ou deixe os três em branco para cadastrar depois).';
  try {
    await pool.query(
      `INSERT INTO clinics (id, name, type, settings, zapi_instance_id, zapi_token, zapi_client_token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        type,
        JSON.stringify(settings),
        whatsapp?.instanceId || null,
        whatsapp ? encrypt(whatsapp.token) : null,
        whatsapp ? encrypt(whatsapp.clientToken) : null,
      ]
    );
    return null;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return `Já existe uma clínica com o identificador "${id}". Escolha outro.`;
    throw error;
  }
}

/** Atualiza o WhatsApp de uma clinica do painel. Tokens em branco mantem os atuais. Retorna erro ou null. */
export async function saveWhatsapp(id, { instanceId, token, clientToken }) {
  const [[row]] = await pool.query('SELECT zapi_token, zapi_client_token FROM clinics WHERE id = ?', [id]);
  if (!row) return 'Clínica não encontrada.';
  if ((!token && !row.zapi_token) || (!clientToken && !row.zapi_client_token)) return 'Informe o token e o Client-Token da Z-API.';
  await pool.query('UPDATE clinics SET zapi_instance_id = ?, zapi_token = ?, zapi_client_token = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [
    instanceId,
    token ? encrypt(token) : row.zapi_token,
    clientToken ? encrypt(clientToken) : row.zapi_client_token,
    id,
  ]);
  return null;
}

export async function setClinicActive(id, active) {
  await pool.query('UPDATE clinics SET active = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [active ? 1 : 0, id]);
}
