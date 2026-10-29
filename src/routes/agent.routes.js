const express = require('express');
const agentService = require('../services/agent.service');
const { requireSecret } = require('../middlewares/auth');
const { loadClinic } = require('../middlewares/clinic');

// Montado em /agent/:clinicId
const router = express.Router({ mergeParams: true });

router.use(requireSecret, loadClinic);

// POST /agent/:clinicId/chat - Enviar mensagem para o agente
router.post('/chat', async (req, res) => {
  try {
    // phone (opcional): simula o telefone do paciente para testar a agenda
    const { messages, phone } = req.body;

    if (!messages) {
      return res.status(400).json({ error: 'messages é obrigatório' });
    }

    const messagesArray = Array.isArray(messages)
      ? messages
      : [{ role: 'user', content: messages }];

    const result = await agentService.chat(req.clinic, messagesArray, { phone });

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
