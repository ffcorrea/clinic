const express = require('express');
const agentService = require('../services/agent.service');

const router = express.Router();

// POST /agent/chat - Enviar mensagem para o agente
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages) {
      return res.status(400).json({ error: 'messages é obrigatório' });
    }

    const messagesArray = Array.isArray(messages)
      ? messages
      : [{ role: 'user', content: messages }];

    const result = await agentService.chat(messagesArray);

    res.json(result);
  } catch (error) {
    console.error('Erro ao comunicar com o agente:', error.message);
    res.status(500).json({
      error: 'Erro ao comunicar com o agente',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;
