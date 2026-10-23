const fs = require('fs');
const path = require('path');
const zapiService = require('./zapi.service');

// Cada consultorio e uma pasta em src/clinics/<id>/ com um config.json:
//   name, type, modelo (opcional), dados do prompt e os NOMES das variaveis de ambiente da Z-API.
// O prompt vem do modelo do tipo, em src/prompts/<type>.md, com os {{campos}} preenchidos
// pelo bloco "prompt" do config.json (lidos ao iniciar; editar e reiniciar o servidor).
const CLINICS_DIR = path.join(__dirname, '..', 'clinics');
const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

const CLINIC_TYPES = fs.readdirSync(PROMPTS_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => path.basename(file, '.md'));

function requireEnv(name, clinicId) {
  const value = process.env[name];
  if (!value) throw new Error(`Consultorio "${clinicId}": variavel de ambiente ${name} nao definida`);
  return value;
}

function toBulletList(value) {
  return Array.isArray(value) ? value.map((item) => `- ${item}`).join('\n') : value;
}

// Monta o prompt: modelo do tipo + campos do config.json. Falha ao iniciar se faltar algum campo,
// para nunca mandar "{{...}}" para o modelo.
function buildPrompt(id, config) {
  if (!CLINIC_TYPES.includes(config.type)) {
    throw new Error(`Consultorio "${id}": "type" deve ser um de ${CLINIC_TYPES.join(', ')} (veio "${config.type}")`);
  }

  const template = fs.readFileSync(path.join(PROMPTS_DIR, `${config.type}.md`), 'utf8');
  const notes = config.prompt?.notes || [];
  const fields = {
    name: config.name,
    ...config.prompt,
    services: toBulletList(config.prompt?.services),
    notes: notes.length ? `\nINFORMAÇÕES ESPECÍFICAS DA CLÍNICA:\n${toBulletList(notes)}\n` : '',
  };

  const missing = new Set();
  const prompt = template.replace(/{{(\w+)}}/g, (_, key) => {
    if (key !== 'notes' && (fields[key] === undefined || fields[key] === '')) missing.add(key);
    return fields[key] ?? '';
  });

  if (missing.size) {
    throw new Error(`Consultorio "${id}": faltam em "prompt" no config.json: ${[...missing].join(', ')}`);
  }
  return prompt;
}

function loadClinic(id) {
  const dir = path.join(CLINICS_DIR, id);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));

  const credentials = {
    instanceId: requireEnv(config.zapi.instanceIdEnv, id),
    token: requireEnv(config.zapi.tokenEnv, id),
    clientToken: requireEnv(config.zapi.clientTokenEnv, id),
  };

  return {
    id,
    name: config.name || id,
    type: config.type,
    model: config.model || process.env.INFERENCE_MODEL,
    prompt: buildPrompt(id, config),
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
  getClinic,
  findByInstanceId,
  listClinics,
};
