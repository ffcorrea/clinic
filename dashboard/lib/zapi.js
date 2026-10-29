// Chamadas a Z-API feitas pelo painel (status, QR Code, webhook) para clinicas cadastradas no banco
async function call(credentials, method, path, body) {
  const res = await fetch(`https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Z-API respondeu ${res.status}`);
  return data;
}

// { connected, smartphoneConnected, error }
export async function getStatus(credentials) {
  try {
    return await call(credentials, 'GET', '/status');
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// Imagem do QR Code (data URL) para conectar o WhatsApp, ou null
export async function getQrCode(credentials) {
  try {
    const data = await call(credentials, 'GET', '/qr-code/image');
    return data?.value || null;
  } catch {
    return null;
  }
}

// Aponta o webhook "Ao receber" para o bot e ativa o aviso de mensagens enviadas pelo proprio numero
export async function setupWebhook(credentials, webhookUrl) {
  await call(credentials, 'PUT', '/update-webhook-received', { value: webhookUrl });
  await call(credentials, 'PUT', '/update-notify-sent-by-me', { notifySentByMe: true });
}
