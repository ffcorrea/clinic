const axios = require('axios');

// Serverless Inference da DigitalOcean (API compativel com OpenAI)
const INFERENCE_ENDPOINT = process.env.INFERENCE_ENDPOINT || 'https://inference.do-ai.run';
const INFERENCE_ACCESS_KEY = process.env.INFERENCE_ACCESS_KEY;
// Teto de tokens por resposta (o prompt ja pede mensagens curtas; isto e so uma trava)
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '300', 10);

// clinic: { model, prompt } vindo do clinic.service
async function chat(clinic, messages) {
  const response = await axios.post(
    `${INFERENCE_ENDPOINT}/v1/chat/completions`,
    {
      model: clinic.model,
      max_tokens: MAX_TOKENS,
      // Sem raciocinio oculto: ele gastava ~5x mais tokens que a propria resposta
      thinking: { type: 'disabled' },
      messages: [{ role: 'system', content: clinic.prompt }, ...messages],
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

async function sendMessage(clinic, content) {
  const messages = [{ role: 'user', content }];
  return chat(clinic, messages);
}

module.exports = {
  chat,
  sendMessage,
};
