const axios = require('axios');

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

const BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Client-Token': ZAPI_CLIENT_TOKEN,
  },
});

/**
 * Envia mensagem de texto
 * @param {string} phone - Numero do telefone (ex: 5511999999999)
 * @param {string} message - Mensagem a ser enviada
 */
async function sendText(phone, message) {
  const response = await api.post('/send-text', {
    phone,
    message,
  });
  return response.data;
}

/**
 * Envia imagem
 * @param {string} phone - Numero do telefone
 * @param {string} image - URL da imagem
 * @param {string} caption - Legenda opcional
 */
async function sendImage(phone, image, caption = '') {
  const response = await api.post('/send-image', {
    phone,
    image,
    caption,
  });
  return response.data;
}

/**
 * Envia documento/arquivo
 * @param {string} phone - Numero do telefone
 * @param {string} document - URL do documento
 * @param {string} fileName - Nome do arquivo
 */
async function sendDocument(phone, document, fileName) {
  const response = await api.post('/send-document', {
    phone,
    document,
    fileName,
  });
  return response.data;
}

/**
 * Envia audio
 * @param {string} phone - Numero do telefone
 * @param {string} audio - URL do audio
 */
async function sendAudio(phone, audio) {
  const response = await api.post('/send-audio', {
    phone,
    audio,
  });
  return response.data;
}

/**
 * Envia video
 * @param {string} phone - Numero do telefone
 * @param {string} video - URL do video
 * @param {string} caption - Legenda opcional
 */
async function sendVideo(phone, video, caption = '') {
  const response = await api.post('/send-video', {
    phone,
    video,
    caption,
  });
  return response.data;
}

/**
 * Envia localizacao
 * @param {string} phone - Numero do telefone
 * @param {string} title - Titulo do local
 * @param {string} address - Endereco
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 */
async function sendLocation(phone, title, address, latitude, longitude) {
  const response = await api.post('/send-location', {
    phone,
    title,
    address,
    latitude,
    longitude,
  });
  return response.data;
}

/**
 * Envia botoes interativos
 * @param {string} phone - Numero do telefone
 * @param {string} message - Mensagem
 * @param {Array} buttons - Array de botoes [{id: '1', label: 'Opcao 1'}]
 */
async function sendButtons(phone, message, buttons) {
  const response = await api.post('/send-button-list', {
    phone,
    message,
    buttonList: {
      buttons: buttons.map(btn => ({
        id: btn.id,
        label: btn.label,
      })),
    },
  });
  return response.data;
}

/**
 * Envia lista de opcoes
 * @param {string} phone - Numero do telefone
 * @param {string} message - Mensagem
 * @param {string} buttonLabel - Label do botao
 * @param {Array} sections - Secoes com opcoes
 */
async function sendList(phone, message, buttonLabel, sections) {
  const response = await api.post('/send-option-list', {
    phone,
    message,
    optionList: {
      title: buttonLabel,
      buttonLabel,
      options: sections,
    },
  });
  return response.data;
}

/**
 * Verifica se o numero tem WhatsApp
 * @param {string} phone - Numero do telefone
 */
async function checkNumber(phone) {
  const response = await api.get(`/phone-exists/${phone}`);
  return response.data;
}

/**
 * Obtem status da instancia
 */
async function getStatus() {
  const response = await api.get('/status');
  return response.data;
}

/**
 * Obtem QR Code para conexao
 */
async function getQRCode() {
  const response = await api.get('/qr-code/image');
  return response.data;
}

/**
 * Desconecta a instancia
 */
async function disconnect() {
  const response = await api.get('/disconnect');
  return response.data;
}

/**
 * Restaura a sessao
 */
async function restart() {
  const response = await api.get('/restart');
  return response.data;
}

/**
 * Processa webhook de mensagem recebida
 * @param {Object} webhookData - Dados do webhook da Z-API
 */
function processIncomingMessage(webhookData) {
  const { phone, text, messageId, fromMe, isGroup, participant, type } = webhookData;

  return {
    messageId,
    phone: phone?.replace('@c.us', '').replace('@g.us', ''),
    text: text?.message || text || '',
    fromMe: fromMe || false,
    isGroup: isGroup || false,
    participant: participant?.replace('@c.us', '') || null,
    type: type || 'text',
    timestamp: new Date().toISOString(),
    raw: webhookData,
  };
}

module.exports = {
  sendText,
  sendImage,
  sendDocument,
  sendAudio,
  sendVideo,
  sendLocation,
  sendButtons,
  sendList,
  checkNumber,
  getStatus,
  getQRCode,
  disconnect,
  restart,
  processIncomingMessage,
};
