const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Serverless Inference da DigitalOcean (API compativel com OpenAI)
const INFERENCE_ENDPOINT = process.env.INFERENCE_ENDPOINT || 'https://inference.do-ai.run';
const INFERENCE_ACCESS_KEY = process.env.INFERENCE_ACCESS_KEY;
const INFERENCE_MODEL = process.env.INFERENCE_MODEL;
// Teto de tokens por resposta (o prompt ja pede mensagens curtas; isto e so uma trava)
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '300', 10);

// Prompt do agente, lido uma vez ao iniciar (editar o arquivo e reiniciar o servidor)
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '..', 'prompts', 'agente-lentes-contato.md'),
  'utf8'
);

async function chat(messages) {
  const response = await axios.post(
    `${INFERENCE_ENDPOINT}/v1/chat/completions`,
    {
      model: INFERENCE_MODEL,
      max_tokens: MAX_TOKENS,
      // Sem raciocinio oculto: ele gastava ~5x mais tokens que a propria resposta
      thinking: { type: 'disabled' },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INFERENCE_ACCESS_KEY}`,
      },
    }
  );

  return response.data;
}

async function sendMessage(content) {
  const messages = [{ role: 'user', content }];
  return chat(messages);
}

module.exports = {
  chat,
  sendMessage,
};
