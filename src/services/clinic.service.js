const fs = require('fs');
const path = require('path');
const db = require('../db');
const agenda = require('./agenda.service');
const zapiService = require('./zapi.service');

// Cada consultorio e uma pasta em src/clinics/<id>/ com um config.json:
//   name, type, modelo (opcional), dados iniciais do prompt e os NOMES das variaveis de ambiente da Z-API.
// Na primeira vez, nome, tipo e dados do prompt vao para a tabela "clinics"; dai em diante sao
// editados no painel (/painel/configuracao) e o config.json so vale se o banco estiver fora.
// O prompt vem do modelo do tipo, em src/prompts/<type>.md, com os {{campos}} preenchidos.
const CLINICS_DIR = path.join(__dirname, '..', 'clinics');
const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

// Quanto tempo o bot usa a configuracao lida do banco antes de ler de novo
const SETTINGS_CACHE_MS = 30 * 1000;

const CLINIC_TYPES = fs.readdirSync(PROMPTS_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => path.basename(file, '.md'));

const REQUIRED_FIELDS = ['professional', 'services', 'instagram'];

function requireEnv(name, clinicId) {
  const value = process.env[name];
  if (!value) throw new Error(`Consultorio "${clinicId}": variavel de ambiente ${name} nao definida`);
  return value;
}

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
    services: toBulletList(settings.services),
    hours: agenda.hoursText(settings.schedule),
    notes: notes.length ? `\nINFORMAÇÕES ESPECÍFICAS DA CLÍNICA:\n${toBulletList(notes)}\n` : '',
  };
  return template.replace(/{{(\w+)}}/g, (_, key) => fields[key] ?? '');
}

function loadClinic(id) {
  const dir = path.join(CLINICS_DIR, id);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));

  // Perfil inicial (vai para o banco na primeira vez)
  const seed = {
    name: config.name || id,
    type: config.type,
    settings: { ...config.prompt, schedule: agenda.withDefaults(config.prompt?.schedule) },
  };
  delete seed.settings.hours;

  const problems = validateProfile(seed);
  if (problems.length) {
    throw new Error(`Consultorio "${id}": config.json invalido, confira: ${problems.join(', ')}`);
  }

  const credentials = {
    instanceId: requireEnv(config.zapi.instanceIdEnv, id),
    token: requireEnv(config.zapi.tokenEnv, id),
    clientToken: requireEnv(config.zapi.clientTokenEnv, id),
  };

  return {
    id,
    name: seed.name,
    type: seed.type,
    model: config.model || process.env.INFERENCE_MODEL,
    seed,
    instanceId: credentials.instanceId,
    zapi: zapiService.createClient(credentials),
  };
}

const clinics = new Map(
  fs.readdirSync(CLINICS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, loadClinic(entry.name)])
);

if (clinics.size === 0) throw new Error(`Nenhum consultorio encontrado em ${CLINICS_DIR}`);

console.log(`Consultorios carregados: ${[...clinics.keys()].join(', ')}`);

// Cria no banco as clinicas que ainda nao existem (a partir do config.json)
if (db.enabled) {
  Promise.all(
    [...clinics.values()].map(({ id, seed }) =>
      db.query('INSERT IGNORE INTO clinics (id, name, type, settings) VALUES (?, ?, ?, ?)', [
        id,
        seed.name,
        seed.type,
        JSON.stringify(seed.settings),
      ])
    )
  ).catch((error) => console.error('Erro ao cadastrar clinicas no banco:', error.message));
}

const profileCache = new Map();

/**
 * Perfil atual da clinica: { name, type, settings } (settings: professional, services, instagram, notes, schedule).
 * Vem do banco (cache de 30s); se o banco falhar ou o perfil salvo for invalido, usa o config.json.
 */
async function getProfile(clinic) {
  const cached = profileCache.get(clinic.id);
  if (cached && Date.now() - cached.at < SETTINGS_CACHE_MS) return cached.profile;

  let profile = clinic.seed;
  if (db.enabled) {
    try {
      const [row] = await db.query('SELECT name, type, settings FROM clinics WHERE id = ?', [clinic.id]);
      if (row) {
        const fromDb = { name: row.name, type: row.type, settings: { ...row.settings, schedule: agenda.withDefaults(row.settings.schedule) } };
        const problems = validateProfile(fromDb);
        if (problems.length) console.error(`[${clinic.id}] Configuracao do banco invalida (${problems.join(', ')}), usando config.json`);
        else profile = fromDb;
      }
    } catch (error) {
      console.error(`[${clinic.id}] Erro ao ler configuracao, usando config.json:`, error.message);
    }
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
  getClinic,
  findByInstanceId,
  listClinics,
  getProfile,
  renderPrompt,
  validateProfile,
};
