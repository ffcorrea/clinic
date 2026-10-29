const fs = require('fs');
const path = require('path');
const db = require('../db');
const agenda = require('./agenda.service');
const zapiService = require('./zapi.service');
const secretBox = require('../lib/secret-box');

// Consultorios ficam todos na tabela "clinics", cadastrados e editados no painel (/painel/clinicas e
// /painel/configuracao): nome, tipo, dados do prompt, agenda e WhatsApp (Z-API, tokens criptografados).
// O bot le a tabela a cada DB_CLINICS_REFRESH_MS, entao clinica nova ou alterada vale sem deploy.
// O prompt vem do modelo do tipo, em src/prompts/<type>.md, com os {{campos}} preenchidos.
const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

// Quanto tempo o bot usa a configuracao lida do banco antes de ler de novo
const SETTINGS_CACHE_MS = 30 * 1000;
const DB_CLINICS_REFRESH_MS = 30 * 1000;

if (!db.enabled) throw new Error('DATABASE_URL nao definida: os consultorios ficam no banco de dados');

const CLINIC_TYPES = fs.readdirSync(PROMPTS_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => path.basename(file, '.md'));

const REQUIRED_FIELDS = ['professional', 'services', 'instagram'];

function toBulletList(value) {
  return Array.isArray(value) ? value.map((item) => `- ${item}`).join('\n') : value;
}

// Valida nome, tipo e dados do prompt. Retorna a lista de problemas (vazia se ok).
function validateProfile({ name, type, settings }) {
  const problems = [];
  if (!name) problems.push('name');
  if (!CLINIC_TYPES.includes(type)) problems.push(`type (use ${CLINIC_TYPES.join(', ')})`);
  for (const field of REQUIRED_FIELDS) {
    const value = settings?.[field];
    if (!value || (Array.isArray(value) && value.length === 0)) problems.push(field);
  }
  return problems;
}

// Monta o prompt: modelo do tipo + dados da clinica + horario de atendimento da agenda
function renderPrompt({ name, type, settings }) {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, `${type}.md`), 'utf8');
  const notes = settings.notes || [];
  const fields = {
    ...settings,
    name,
    services: toBulletList(agenda.serviceList(settings).map((s) => s.name)),
    hours: agenda.hoursText(settings.schedule),
    notes: notes.length ? `\nINFORMAÇÕES ESPECÍFICAS DA CLÍNICA:\n${toBulletList(notes)}\n` : '',
  };
  return template.replace(/{{(\w+)}}/g, (_, key) => fields[key] ?? '');
}

const toProfile = (row) => ({
  name: row.name,
  type: row.type,
  settings: { ...row.settings, schedule: agenda.withDefaults(row.settings.schedule) },
});

// Consultorios ativos e com WhatsApp cadastrado: id -> { id, name, type, model, seed, instanceId, zapi }
const clinics = new Map();

async function refreshClinics() {
  const rows = await db.query(
    'SELECT id, name, type, settings, zapi_instance_id, zapi_token, zapi_client_token, active FROM clinics'
  );
  const seen = new Set();

  for (const row of rows) {
    if (!row.active || !row.zapi_instance_id || !row.zapi_token || !row.zapi_client_token) continue;

    let credentials;
    try {
      credentials = {
        instanceId: row.zapi_instance_id,
        token: secretBox.decrypt(row.zapi_token),
        clientToken: secretBox.decrypt(row.zapi_client_token),
      };
    } catch (error) {
      console.error(`[${row.id}] Nao foi possivel ler as credenciais da Z-API (chave trocada?):`, error.message);
      // Mantem a conexao que ja estava funcionando, se houver
      if (clinics.has(row.id)) seen.add(row.id);
      continue;
    }
    seen.add(row.id);

    const current = clinics.get(row.id);
    const fingerprint = `${credentials.instanceId}|${credentials.token}|${credentials.clientToken}`;
    if (current?.fingerprint === fingerprint) continue;

    clinics.set(row.id, {
      id: row.id,
      name: row.name,
      type: row.type,
      model: process.env.INFERENCE_MODEL,
      // Perfil de reserva se a leitura da configuracao falhar depois
      seed: toProfile(row),
      instanceId: credentials.instanceId,
      zapi: zapiService.createClient(credentials),
      fingerprint,
    });
    console.log(`[${row.id}] Consultorio ${current ? 'atualizado' : 'carregado'}`);
  }

  // Desativados, removidos ou sem WhatsApp
  for (const id of clinics.keys()) {
    if (!seen.has(id)) {
      clinics.delete(id);
      console.log(`[${id}] Consultorio removido do bot (desativado ou sem WhatsApp)`);
    }
  }
}

const refresh = () => refreshClinics().catch((error) => console.error('Erro ao carregar consultorios do banco:', error.message));
const loaded = db.ready.then(refresh);
setInterval(refresh, DB_CLINICS_REFRESH_MS).unref();

const profileCache = new Map();

/**
 * Perfil atual da clinica: { name, type, settings } (settings: professional, services, instagram, notes, schedule).
 * Vem do banco (cache de 30s); se a leitura falhar ou o perfil salvo for invalido, usa o ultimo perfil valido.
 */
async function getProfile(clinic) {
  const cached = profileCache.get(clinic.id);
  if (cached && Date.now() - cached.at < SETTINGS_CACHE_MS) return cached.profile;

  let profile = cached?.profile || clinic.seed;
  try {
    const [row] = await db.query('SELECT name, type, settings FROM clinics WHERE id = ?', [clinic.id]);
    if (row) {
      const fromDb = toProfile(row);
      const problems = validateProfile(fromDb);
      if (problems.length) console.error(`[${clinic.id}] Configuracao do banco invalida (${problems.join(', ')}), usando a anterior`);
      else profile = fromDb;
    }
  } catch (error) {
    console.error(`[${clinic.id}] Erro ao ler configuracao, usando a anterior:`, error.message);
  }

  profileCache.set(clinic.id, { profile, at: Date.now() });
  return profile;
}

function getClinic(id) {
  return clinics.get(id);
}

// A Z-API envia o instanceId no webhook; serve para achar o consultorio
function findByInstanceId(instanceId) {
  for (const clinic of clinics.values()) {
    if (clinic.instanceId === instanceId) return clinic;
  }
  return undefined;
}

function listClinics() {
  return [...clinics.values()].map(({ id, name, type, model }) => ({ id, name, type, model }));
}

module.exports = {
  CLINIC_TYPES,
  loaded,
  getClinic,
  findByInstanceId,
  listClinics,
  getProfile,
  renderPrompt,
  validateProfile,
};
