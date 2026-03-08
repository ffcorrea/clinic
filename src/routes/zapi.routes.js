const express = require('express');
const zapiService = require('../services/zapi.service');
const agentService = require('../services/agent.service');

const router = express.Router();

// POST /zapi/send-text - Enviar mensagem de texto
router.post('/send-text', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'phone e message sao obrigatorios' });
    }

    const result = await zapiService.sendText(phone, message);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar mensagem',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/send-image - Enviar imagem
router.post('/send-image', async (req, res) => {
  try {
    const { phone, image, caption } = req.body;

    if (!phone || !image) {
      return res.status(400).json({ error: 'phone e image sao obrigatorios' });
    }

    const result = await zapiService.sendImage(phone, image, caption);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar imagem:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar imagem',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/send-document - Enviar documento
router.post('/send-document', async (req, res) => {
  try {
    const { phone, document, fileName } = req.body;

    if (!phone || !document || !fileName) {
      return res.status(400).json({ error: 'phone, document e fileName sao obrigatorios' });
    }

    const result = await zapiService.sendDocument(phone, document, fileName);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar documento:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar documento',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/send-audio - Enviar audio
router.post('/send-audio', async (req, res) => {
  try {
    const { phone, audio } = req.body;

    if (!phone || !audio) {
      return res.status(400).json({ error: 'phone e audio sao obrigatorios' });
    }

    const result = await zapiService.sendAudio(phone, audio);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar audio:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar audio',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/send-video - Enviar video
router.post('/send-video', async (req, res) => {
  try {
    const { phone, video, caption } = req.body;

    if (!phone || !video) {
      return res.status(400).json({ error: 'phone e video sao obrigatorios' });
    }

    const result = await zapiService.sendVideo(phone, video, caption);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar video:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar video',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/send-location - Enviar localizacao
router.post('/send-location', async (req, res) => {
  try {
    const { phone, title, address, latitude, longitude } = req.body;

    if (!phone || !latitude || !longitude) {
      return res.status(400).json({ error: 'phone, latitude e longitude sao obrigatorios' });
    }

    const result = await zapiService.sendLocation(phone, title, address, latitude, longitude);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar localizacao:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar localizacao',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/send-buttons - Enviar botoes
router.post('/send-buttons', async (req, res) => {
  try {
    const { phone, message, buttons } = req.body;

    if (!phone || !message || !buttons) {
      return res.status(400).json({ error: 'phone, message e buttons sao obrigatorios' });
    }

    const result = await zapiService.sendButtons(phone, message, buttons);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar botoes:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar botoes',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/send-list - Enviar lista
router.post('/send-list', async (req, res) => {
  try {
    const { phone, message, buttonLabel, sections } = req.body;

    if (!phone || !message || !buttonLabel || !sections) {
      return res.status(400).json({ error: 'phone, message, buttonLabel e sections sao obrigatorios' });
    }

    const result = await zapiService.sendList(phone, message, buttonLabel, sections);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar lista:', error.message);
    res.status(500).json({
      error: 'Erro ao enviar lista',
      details: error.response?.data || error.message,
    });
  }
});

// GET /zapi/check-number/:phone - Verificar se numero tem WhatsApp
router.get('/check-number/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const result = await zapiService.checkNumber(phone);
    res.json(result);
  } catch (error) {
    console.error('Erro ao verificar numero:', error.message);
    res.status(500).json({
      error: 'Erro ao verificar numero',
      details: error.response?.data || error.message,
    });
  }
});

// GET /zapi/status - Status da instancia
router.get('/status', async (req, res) => {
  try {
    const result = await zapiService.getStatus();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter status:', error.message);
    res.status(500).json({
      error: 'Erro ao obter status',
      details: error.response?.data || error.message,
    });
  }
});

// GET /zapi/qr-code - Obter QR Code
router.get('/qr-code', async (req, res) => {
  try {
    const result = await zapiService.getQRCode();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter QR Code:', error.message);
    res.status(500).json({
      error: 'Erro ao obter QR Code',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/disconnect - Desconectar instancia
router.post('/disconnect', async (req, res) => {
  try {
    const result = await zapiService.disconnect();
    res.json(result);
  } catch (error) {
    console.error('Erro ao desconectar:', error.message);
    res.status(500).json({
      error: 'Erro ao desconectar',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/restart - Reiniciar instancia
router.post('/restart', async (req, res) => {
  try {
    const result = await zapiService.restart();
    res.json(result);
  } catch (error) {
    console.error('Erro ao reiniciar:', error.message);
    res.status(500).json({
      error: 'Erro ao reiniciar',
      details: error.response?.data || error.message,
    });
  }
});

// POST /zapi/webhook - Receber mensagens (webhook da Z-API)
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;

    console.log('Webhook recebido:', JSON.stringify(webhookData, null, 2));

    // Ignora mensagens enviadas por nos mesmos
    if (webhookData.fromMe) {
      return res.json({ status: 'ignored', reason: 'fromMe' });
    }

    // Ignora se nao for mensagem de texto
    if (!webhookData.text) {
      return res.json({ status: 'ignored', reason: 'not_text' });
    }

    // Processa a mensagem recebida
    const message = zapiService.processIncomingMessage(webhookData);

    console.log('Mensagem processada:', message);

    // Envia para o agente IA e obtem resposta
    const agentResponse = await agentService.sendMessage(message.text);

    // Extrai a resposta do agente
    const responseText = agentResponse.choices?.[0]?.message?.content || 'Desculpe, nao consegui processar sua mensagem.';

    // Envia resposta de volta pelo WhatsApp
    await zapiService.sendText(message.phone, responseText);

    res.json({
      status: 'processed',
      messageId: message.messageId,
      response: responseText,
    });
  } catch (error) {
    console.error('Erro no webhook:', error.message);
    console.error('Detalhes do erro:', JSON.stringify(error.response?.data, null, 2));
    res.status(500).json({
      error: 'Erro ao processar webhook',
      details: error.message,
    });
  }
});

// POST /zapi/webhook/status - Webhook de status (conexao, desconexao, etc)
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

module.exports = router;
