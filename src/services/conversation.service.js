// Estado das conversas em memoria (por consultorio + telefone).
// Obs: reiniciar o servidor apaga o historico. Para producao com mais de
// uma instancia, trocar por Redis ou banco de dados.

const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '20', 10);
const HISTORY_TTL_MS = parseInt(process.env.HISTORY_TTL_MINUTES || '120', 10) * 60 * 1000;
const HUMAN_PAUSE_MS = parseInt(process.env.HUMAN_PAUSE_MINUTES || '60', 10) * 60 * 1000;
const PROCESSED_IDS_LIMIT = 1000;

const conversations = new Map();
const processedIds = new Set();
const botSentIds = new Set();

function addLimited(set, value) {
  set.add(value);
  if (set.size > PROCESSED_IDS_LIMIT) {
    set.delete(set.values().next().value);
  }
}

// O mesmo paciente pode falar com mais de um consultorio
function conversationKey(clinicId, phone) {
  return `${clinicId}:${phone}`;
}

function getConversation(clinicId, phone) {
  const key = conversationKey(clinicId, phone);
  let conv = conversations.get(key);

  if (!conv || Date.now() - conv.updatedAt > HISTORY_TTL_MS) {
    conv = { history: [], updatedAt: Date.now(), pausedUntil: conv?.pausedUntil || 0 };
    conversations.set(key, conv);
  }

  return conv;
}

function getHistory(clinicId, phone) {
  return getConversation(clinicId, phone).history;
}

function addMessage(clinicId, phone, role, content) {
  const conv = getConversation(clinicId, phone);
  conv.history.push({ role, content });

  if (conv.history.length > MAX_HISTORY) {
    conv.history.splice(0, conv.history.length - MAX_HISTORY);
  }

  conv.updatedAt = Date.now();
}

function clearHistory(clinicId, phone) {
  conversations.delete(conversationKey(clinicId, phone));
}

// Pausa o bot para um telefone (atendente humano assumiu)
function pauseBot(clinicId, phone, durationMs = HUMAN_PAUSE_MS) {
  getConversation(clinicId, phone).pausedUntil = Date.now() + durationMs;
}

function resumeBot(clinicId, phone) {
  getConversation(clinicId, phone).pausedUntil = 0;
}

function isBotPaused(clinicId, phone) {
  return getConversation(clinicId, phone).pausedUntil > Date.now();
}

// Evita processar a mesma mensagem duas vezes (reenvio de webhook)
function markProcessed(messageId) {
  if (!messageId) return false;
  if (processedIds.has(messageId)) return true;

  addLimited(processedIds, messageId);
  return false;
}

// Registra mensagens enviadas pelo bot, para diferenciar de mensagens do atendente
function markSentByBot(messageId) {
  if (messageId) addLimited(botSentIds, messageId);
}

function wasSentByBot(messageId) {
  return botSentIds.has(messageId);
}

// Remove conversas expiradas periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, conv] of conversations) {
    if (now - conv.updatedAt > HISTORY_TTL_MS && conv.pausedUntil < now) {
      conversations.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

module.exports = {
  getHistory,
  addMessage,
  clearHistory,
  pauseBot,
  resumeBot,
  isBotPaused,
  markProcessed,
  markSentByBot,
  wasSentByBot,
};
