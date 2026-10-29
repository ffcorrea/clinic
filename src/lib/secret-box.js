const crypto = require('crypto');

// Criptografa segredos guardados no banco (tokens da Z-API). AES-256-GCM.
// Chave: CREDENTIALS_KEY (recomendado) ou, sem ela, derivada do WEBHOOK_SECRET.
// Trocar a chave invalida os tokens ja salvos (precisam ser cadastrados de novo no painel).
// Mesmo formato de dashboard/lib/secret-box.js.
function key() {
  const base = process.env.CREDENTIALS_KEY || process.env.WEBHOOK_SECRET;
  if (!base) throw new Error('defina CREDENTIALS_KEY (ou WEBHOOK_SECRET) para guardar credenciais');
  return crypto.createHash('sha256').update(`clinic-credentials|${base}`).digest();
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

function decrypt(box) {
  const [version, iv, tag, data] = String(box || '').split(':');
  if (version !== 'v1') throw new Error('formato de credencial desconhecido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
