const axios = require('axios');

const AGENT_ENDPOINT = process.env.AGENT_ENDPOINT;
const AGENT_ACCESS_KEY = process.env.AGENT_ACCESS_KEY;

async function chat(messages, options = {}) {
  const response = await axios.post(
    `${AGENT_ENDPOINT}/api/v1/chat/completions`,
    {
      messages,
      stream: options.stream || false,
      include_functions_info: options.includeFunctionsInfo || false,
      include_retrieval_info: options.includeRetrievalInfo || false,
      include_guardrails_info: options.includeGuardrailsInfo || false,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENT_ACCESS_KEY}`,
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
