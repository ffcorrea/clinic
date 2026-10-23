const agentService = require('./agent.service');
const conversation = require('./conversation.service');
const usage = require('./usage.service');

// Tempo de espera para juntar mensagens enviadas em sequencia pelo paciente
const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_SECONDS || '5', 10) * 1000;

const FALLBACK_MESSAGE =
  'Desculpe, tive um problema para responder agora. Por favor, tente novamente em alguns instantes ou aguarde que um de nossos atendentes vai falar com você.';

const UNSUPPORTED_MEDIA_MESSAGE =
  'No momento consigo entender apenas mensagens de texto. Pode escrever sua dúvida, por favor? 😊';

const buffers = new Map();

// Converte o Markdown do agente para a formatacao do WhatsApp
function toWhatsAppFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/~~(.+?)~~/g, '~$1~')
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1: $2');
}

async function sendBotText(clinic, phone, message) {
  const result = await clinic.zapi.sendText(phone, message);
  conversation.markSentByBot(result?.messageId);
  conversation.markSentByBot(result?.zaapId);
  return result;
}

/**
 * Recebe uma mensagem de texto do paciente e agenda o processamento.
 * Mensagens que chegam dentro do DEBOUNCE_MS sao agrupadas em uma so.
 */
function enqueueMessage(clinic, phone, text) {
  const key = `${clinic.id}:${phone}`;
  let buffer = buffers.get(key);

  if (!buffer) {
    buffer = { texts: [], timer: null };
    buffers.set(key, buffer);
  }

  buffer.texts.push(text);
  clearTimeout(buffer.timer);
  buffer.timer = setTimeout(() => flush(clinic, phone), DEBOUNCE_MS);
}

async function flush(clinic, phone) {
  const key = `${clinic.id}:${phone}`;
  const buffer = buffers.get(key);
  buffers.delete(key);
  if (!buffer || buffer.texts.length === 0) return;

  // Atendente pode ter assumido enquanto esperavamos
  if (conversation.isBotPaused(clinic.id, phone)) return;

  const userText = buffer.texts.join('\n');
  conversation.addMessage(clinic.id, phone, 'user', userText);

  const messagesIn = buffer.texts.length;
  let result;

  try {
    result = await agentService.chat(clinic, conversation.getHistory(clinic.id, phone));
    const reply = result.choices?.[0]?.message?.content?.trim();

    if (!reply) throw new Error('Resposta vazia do agente');

    // Checa de novo: o atendente pode ter respondido durante a chamada ao agente
    // (os tokens ja foram gastos, entao registra mesmo sem enviar)
    if (conversation.isBotPaused(clinic.id, phone)) {
      usage.record(clinic, { phone, kind: 'reply', messagesIn, usage: result.usage });
      return;
    }

    conversation.addMessage(clinic.id, phone, 'assistant', reply);
    await sendBotText(clinic, phone, toWhatsAppFormat(reply));
    usage.record(clinic, { phone, kind: 'reply', messagesIn, messagesOut: 1, usage: result.usage });
  } catch (error) {
    console.error(`[${clinic.id}] Erro ao responder ${phone}:`, error.message, error.response?.data || '');
    await sendBotText(clinic, phone, FALLBACK_MESSAGE).catch(() => {});
    usage.record(clinic, { phone, kind: 'error', messagesIn, messagesOut: 1, usage: result?.usage });
  }
}

async function replyUnsupportedMedia(clinic, phone) {
  if (conversation.isBotPaused(clinic.id, phone)) return;
  await sendBotText(clinic, phone, UNSUPPORTED_MEDIA_MESSAGE);
  usage.record(clinic, { phone, kind: 'unsupported_media', messagesIn: 1, messagesOut: 1 });
}

/**
 * Trata o payload do webhook "Ao receber" da Z-API de um consultorio.
 */
async function handleWebhook(clinic, data) {
  // Ignora grupos, status, broadcast, canais e chamadas
  if (data.isGroup || data.isNewsletter || data.broadcast || data.isStatusReply) return;
  if (data.type !== 'ReceivedCallback' || data.isEdit || data.waitingMessage) return;

  if (conversation.markProcessed(data.messageId)) return;

  const phone = data.phone;

  // Mensagem enviada pelo proprio numero da clinica, mas nao pelo bot:
  // significa que um atendente respondeu pelo celular/WhatsApp Web -> pausa o bot
  // (requer "notificar enviadas por mim" ativo na Z-API)
  if (data.fromMe) {
    if (!data.fromApi && !conversation.wasSentByBot(data.messageId)) {
      conversation.pauseBot(clinic.id, phone);
      console.log(`[${clinic.id}] Atendente humano assumiu ${phone}, bot pausado`);
    }
    return;
  }

  if (conversation.isBotPaused(clinic.id, phone)) return;

  const text = data.text?.message || data.image?.caption;

  if (text) {
    enqueueMessage(clinic, phone, text);
  } else if (data.audio || data.image || data.video || data.document || data.sticker) {
    await replyUnsupportedMedia(clinic, phone);
  }
}

module.exports = {
  handleWebhook,
};
