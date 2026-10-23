const fs = require('fs');
const path = require('path');
const zapiService = require('./zapi.service');

// Cada consultorio e uma pasta em src/clinics/<id>/ com:
//   config.json - nome, modelo (opcional) e os NOMES das variaveis de ambiente da Z-API
//   prompt.md   - prompt do agente (lido ao iniciar; editar e reiniciar o servidor)
const CLINICS_DIR = path.join(__dirname, '..', 'clinics');

function requireEnv(name, clinicId) {
  const value = process.env[name];
  if (!value) throw new Error(`Consultorio "${clinicId}": variavel de ambiente ${name} nao definida`);
  return value;
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
    model: config.model || process.env.INFERENCE_MODEL,
    prompt: fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8'),
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
  return [...clinics.values()].map(({ id, name, model }) => ({ id, name, model }));
}

module.exports = {
  getClinic,
  findByInstanceId,
  listClinics,
};
