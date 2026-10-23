const express = require('express');
const clinicService = require('../services/clinic.service');
const chatbotService = require('../services/chatbot.service');
const conversationService = require('../services/conversation.service');
const { requireSecret } = require('../middlewares/auth');
const { loadClinic } = require('../middlewares/clinic');

// Montado em /zapi/:clinicId (ex: /zapi/glaucia-roversi/send-text)
const router = express.Router({ mergeParams: true });

router.use(requireSecret, loadClinic);

// POST /zapi/:clinicId/send-text - Enviar mensagem de texto
router.post('/send-text', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'phone e message sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendText(phone, message);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar mensagem',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/send-image - Enviar imagem
router.post('/send-image', async (req, res) => {
  try {
    const { phone, image, caption } = req.body;

    if (!phone || !image) {
      return res.status(400).json({ error: 'phone e image sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendImage(phone, image, caption);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar imagem:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar imagem',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/send-document - Enviar documento
router.post('/send-document', async (req, res) => {
  try {
    const { phone, document, fileName } = req.body;

    if (!phone || !document || !fileName) {
      return res.status(400).json({ error: 'phone, document e fileName sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendDocument(phone, document, fileName);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar documento:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar documento',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/send-audio - Enviar audio
router.post('/send-audio', async (req, res) => {
  try {
    const { phone, audio } = req.body;

    if (!phone || !audio) {
      return res.status(400).json({ error: 'phone e audio sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendAudio(phone, audio);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar audio:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar audio',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/send-video - Enviar video
router.post('/send-video', async (req, res) => {
  try {
    const { phone, video, caption } = req.body;

    if (!phone || !video) {
      return res.status(400).json({ error: 'phone e video sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendVideo(phone, video, caption);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar video:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar video',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/send-location - Enviar localizacao
router.post('/send-location', async (req, res) => {
  try {
    const { phone, title, address, latitude, longitude } = req.body;

    if (!phone || !latitude || !longitude) {
      return res.status(400).json({ error: 'phone, latitude e longitude sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendLocation(phone, title, address, latitude, longitude);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar localizacao:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar localizacao',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/send-buttons - Enviar botoes
router.post('/send-buttons', async (req, res) => {
  try {
    const { phone, message, buttons } = req.body;

    if (!phone || !message || !buttons) {
      return res.status(400).json({ error: 'phone, message e buttons sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendButtons(phone, message, buttons);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar botoes:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar botoes',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/send-list - Enviar lista
router.post('/send-list', async (req, res) => {
  try {
    const { phone, message, buttonLabel, sections } = req.body;

    if (!phone || !message || !buttonLabel || !sections) {
      return res.status(400).json({ error: 'phone, message, buttonLabel e sections sao obrigatorios' });
    }

    const result = await req.clinic.zapi.sendList(phone, message, buttonLabel, sections);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar lista:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar lista',
      details: error.response?.data || error.message,
    });
  }
});

// GET /zapi/:clinicId/check-number/:phone - Verificar se numero tem WhatsApp
router.get('/check-number/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const result = await req.clinic.zapi.checkNumber(phone);
    res.json(result);
  } catch (error) {
    console.error('Erro ao verificar numero:', error.message);
    res.status(500).json({
      error: 'Erro ao verificar numero',
      details: error.response?.data || error.message,
    });
  }
});

// GET /zapi/:clinicId/status - Status da instancia
router.get('/status', async (req, res) => {
  try {
    const result = await req.clinic.zapi.getStatus();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter status:', error.message);
    res.status(500).json({
      error: 'Erro ao obter status',
      details: error.response?.data || error.message,
    });
  }
});

// GET /zapi/:clinicId/qr-code - Obter QR Code
router.get('/qr-code', async (req, res) => {
  try {
    const result = await req.clinic.zapi.getQRCode();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter QR Code:', error.message);
    res.status(500).json({
      error: 'Erro ao obter QR Code',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/disconnect - Desconectar instancia
router.post('/disconnect', async (req, res) => {
  try {
    const result = await req.clinic.zapi.disconnect();
    res.json(result);
  } catch (error) {
    console.error('Erro ao desconectar:', error.message);
    res.status(500).json({
      error: 'Erro ao desconectar',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/restart - Reiniciar instancia
router.post('/restart', async (req, res) => {
  try {
    const result = await req.clinic.zapi.restart();
    res.json(result);
  } catch (error) {
    console.error('Erro ao reiniciar:', error.message);
    res.status(500).json({
      error: 'Erro ao reiniciar',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/webhook - Receber mensagens (webhook "Ao receber" da Z-API)
router.post('/webhook', (req, res) => {
  // Responde na hora para a Z-API nao reenviar; o processamento segue em segundo plano
  res.json({ status: 'received' });

  chatbotService.handleWebhook(req.clinic, req.body).catch((error) => {
    console.error(`[${req.clinic.id}] Erro no webhook:`, error.message, error.response?.data || '');
  });
});

// POST /zapi/:clinicId/setup-webhook - Configura na Z-API a URL do webhook e o aviso de mensagens enviadas por mim
// body: { url: "https://seu-dominio.com" }
router.post('/setup-webhook', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url e obrigatoria' });
    }

    const secret = process.env.WEBHOOK_SECRET;
    const webhookUrl = `${url.replace(/\/$/, '')}/zapi/${req.clinic.id}/webhook${secret ? `?token=${secret}` : ''}`;

    const webhook = await req.clinic.zapi.updateWebhookReceived(webhookUrl);
    const notifySentByMe = await req.clinic.zapi.updateNotifySentByMe(true);

    res.json({ webhookUrl, webhook, notifySentByMe });
  } catch (error) {
    console.error('Erro ao configurar webhook:', error.message);
    res.status(500).json({
      error: 'Erro ao configurar webhook',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/:clinicId/bot/:phone/pause - Pausa o bot para um paciente (atendimento humano)
router.post('/bot/:phone/pause', (req, res) => {
  const minutes = parseInt(req.body?.minutes || process.env.HUMAN_PAUSE_MINUTES || '60', 10);
  conversationService.pauseBot(req.clinic.id, req.params.phone, minutes * 60 * 1000);
  res.json({ status: 'paused', minutes });
});

// POST /zapi/:clinicId/bot/:phone/resume - Reativa o bot para um paciente
router.post('/bot/:phone/resume', (req, res) => {
  conversationService.resumeBot(req.clinic.id, req.params.phone);
  res.json({ status: 'resumed' });
});

// POST /zapi/:clinicId/bot/:phone/reset - Apaga o historico da conversa
router.post('/bot/:phone/reset', (req, res) => {
  conversationService.clearHistory(req.clinic.id, req.params.phone);
  res.json({ status: 'reset' });
});

// POST /zapi/:clinicId/webhook/status - Webhook de status (conexao, desconexao, etc)
router.post('/webhook/status', async (req, res) => {
  try {
    const statusData = req.body;
    console.log('Status webhook recebido:', JSON.stringify(statusData, null, 2));
    res.json({ status: 'received' });
  } catch (error) {
    console.error('Erro no webhook de status:', error.message);
    res.status(500).json({ error: 'Erro ao processar webhook de status' });
  }
});

// POST /zapi/webhook - Webhook antigo, sem o consultorio na URL.
// Identifica o consultorio pelo instanceId que a Z-API envia no payload.
function webhookByInstance(req, res) {
  res.json({ status: 'received' });

  const clinic = clinicService.findByInstanceId(req.body?.instanceId);
  if (!clinic) {
    console.error('Webhook de instancia desconhecida:', req.body?.instanceId);
    return;
  }

  chatbotService.handleWebhook(clinic, req.body).catch((error) => {
    console.error(`[${clinic.id}] Erro no webhook:`, error.message, error.response?.data || '');
  });
}

module.exports = router;
module.exports.webhookByInstance = webhookByInstance;
