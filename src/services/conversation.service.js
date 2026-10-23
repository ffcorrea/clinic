// Estado das conversas em memoria (por telefone).
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

function getConversation(phone) {
  let conv = conversations.get(phone);

  if (!conv || Date.now() - conv.updatedAt > HISTORY_TTL_MS) {
    conv = { history: [], updatedAt: Date.now(), pausedUntil: conv?.pausedUntil || 0 };
    conversations.set(phone, conv);
  }

  return conv;
}

function getHistory(phone) {
  return getConversation(phone).history;
}

function addMessage(phone, role, content) {
  const conv = getConversation(phone);
  conv.history.push({ role, content });

  if (conv.history.length > MAX_HISTORY) {
    conv.history.splice(0, conv.history.length - MAX_HISTORY);
  }

  conv.updatedAt = Date.now();
}

function clearHistory(phone) {
  conversations.delete(phone);
}

// Pausa o bot para um telefone (atendente humano assumiu)
function pauseBot(phone, durationMs = HUMAN_PAUSE_MS) {
  getConversation(phone).pausedUntil = Date.now() + durationMs;
}

function resumeBot(phone) {
  getConversation(phone).pausedUntil = 0;
}

function isBotPaused(phone) {
  return getConversation(phone).pausedUntil > Date.now();
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
  for (const [phone, conv] of conversations) {
    if (now - conv.updatedAt > HISTORY_TTL_MS && conv.pausedUntil < now) {
      conversations.delete(phone);
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
