const zapiService = require('./zapi.service');
const agentService = require('./agent.service');
const conversation = require('./conversation.service');

// Tempo de espera para juntar mensagens enviadas em sequencia pelo paciente
const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_SECONDS || '5', 10) * 1000;

const FALLBACK_MESSAGE =
  'Desculpe, tive um problema para responder agora. Por favor, tente novamente em alguns instantes ou aguarde que um de nossos atendentes vai falar com você.';

const UNSUPPORTED_MEDIA_MESSAGE =
  'No momento consigo entender apenas mensagens de texto. Pode escrever sua dúvida, por favor? 😊';

const buffers = new Map();

async function sendBotText(phone, message) {
  const result = await zapiService.sendText(phone, message);
  conversation.markSentByBot(result?.messageId);
  conversation.markSentByBot(result?.zaapId);
  return result;
}

/**
 * Recebe uma mensagem de texto do paciente e agenda o processamento.
 * Mensagens que chegam dentro do DEBOUNCE_MS sao agrupadas em uma so.
 */
function enqueueMessage(phone, text) {
  let buffer = buffers.get(phone);

  if (!buffer) {
    buffer = { texts: [], timer: null };
    buffers.set(phone, buffer);
  }

  buffer.texts.push(text);
  clearTimeout(buffer.timer);
  buffer.timer = setTimeout(() => flush(phone), DEBOUNCE_MS);
}

async function flush(phone) {
  const buffer = buffers.get(phone);
  buffers.delete(phone);
  if (!buffer || buffer.texts.length === 0) return;

  // Atendente pode ter assumido enquanto esperavamos
  if (conversation.isBotPaused(phone)) return;

  const userText = buffer.texts.join('\n');
  conversation.addMessage(phone, 'user', userText);

  try {
    const result = await agentService.chat(conversation.getHistory(phone));
    const reply = result.choices?.[0]?.message?.content?.trim();

    if (!reply) throw new Error('Resposta vazia do agente');

    // Checa de novo: o atendente pode ter respondido durante a chamada ao agente
    if (conversation.isBotPaused(phone)) return;

    conversation.addMessage(phone, 'assistant', reply);
    await sendBotText(phone, reply);
  } catch (error) {
    console.error(`Erro ao responder ${phone}:`, error.message, error.response?.data || '');
    await sendBotText(phone, FALLBACK_MESSAGE).catch(() => {});
  }
}

async function replyUnsupportedMedia(phone) {
  if (conversation.isBotPaused(phone)) return;
  await sendBotText(phone, UNSUPPORTED_MEDIA_MESSAGE);
}

/**
 * Trata o payload do webhook "Ao receber" da Z-API.
 */
async function handleWebhook(data) {
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
      conversation.pauseBot(phone);
      console.log(`Atendente humano assumiu ${phone}, bot pausado`);
    }
    return;
  }

  if (conversation.isBotPaused(phone)) return;

  const text = data.text?.message || data.image?.caption;

  if (text) {
    enqueueMessage(phone, text);
  } else if (data.audio || data.image || data.video || data.document || data.sticker) {
    await replyUnsupportedMedia(phone);
  }
}

module.exports = {
  handleWebhook,
};
