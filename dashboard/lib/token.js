import crypto from 'node:crypto';

// Cookie de sessao assinado (HMAC). Arquivo leve: tambem usado pelo proxy.js.
// Sem SESSION_SECRET, a chave deriva dos segredos que ja existem.
function secret() {
  const base = process.env.SESSION_SECRET || `${process.env.WEBHOOK_SECRET}|${process.env.DATABASE_URL}`;
  return crypto.createHash('sha256').update(base).digest();
}

export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

// Payload se assinatura e validade estiverem ok, senao null
export function readToken(token) {
  const [body, mac] = (token || '').split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
