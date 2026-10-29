const axios = require('axios');
const db = require('../db');

// Registra no MySQL o uso de cada atendimento, para o painel em dashboard/.
// Sem banco configurado o registro fica desligado e o bot funciona normalmente.

// Preco do modelo em US$ por 1 milhao de tokens (conferir na tabela da DigitalOcean)
const PRICE_INPUT_PER_MTOK = parseFloat(process.env.PRICE_INPUT_PER_MTOK || '1');
const PRICE_OUTPUT_PER_MTOK = parseFloat(process.env.PRICE_OUTPUT_PER_MTOK || '5');

// Cotacao do dolar, guardada em cada registro. Tenta as fontes em ordem (todas sem chave).
const FX_SOURCES = [
  { name: 'AwesomeAPI', url: 'https://economia.awesomeapi.com.br/json/last/USD-BRL', parse: (d) => parseFloat(d?.USDBRL?.bid) },
  { name: 'Frankfurter', url: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL', parse: (d) => d?.rates?.BRL },
  { name: 'ExchangeRate-API', url: 'https://open.er-api.com/v6/latest/USD', parse: (d) => d?.rates?.BRL },
];
const FX_CACHE_MS = 60 * 60 * 1000;

let fx = { rate: null, fetchedAt: 0 };

async function getUsdBrl() {
  if (fx.rate && Date.now() - fx.fetchedAt < FX_CACHE_MS) return fx.rate;

  for (const source of FX_SOURCES) {
    try {
      const { data } = await axios.get(source.url, { timeout: 5000 });
      const rate = Number(source.parse(data));
      if (rate > 0) {
        fx = { rate, fetchedAt: Date.now() };
        return rate;
      }
      throw new Error('resposta sem cotacao');
    } catch (error) {
      console.error(`Cotacao do dolar: ${source.name} falhou (${error.message})`);
    }
  }

  // Se todas falharem, usa a ultima cotacao conhecida (ou null)
  return fx.rate;
}

/**
 * Grava um atendimento. Nunca lanca erro: falha no registro nao pode afetar o paciente.
 * @param {Object} clinic - consultorio do clinic.service
 * @param {Object} event - { phone, kind, messagesIn, messagesOut, usage }
 *   usage: objeto "usage" da resposta do modelo ({ prompt_tokens, completion_tokens })
 */
async function record(clinic, { phone, kind, messagesIn = 0, messagesOut = 0, usage }) {
  if (!db.enabled) return;

  try {
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const costUsd =
      (promptTokens * PRICE_INPUT_PER_MTOK + completionTokens * PRICE_OUTPUT_PER_MTOK) / 1e6;

    await db.query(
      `INSERT INTO usage_events
        (clinic_id, clinic_name, phone, kind, model, messages_in, messages_out,
         prompt_tokens, completion_tokens, cost_usd, usd_brl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clinic.id,
        clinic.name,
        phone,
        kind,
        clinic.model,
        messagesIn,
        messagesOut,
        promptTokens,
        completionTokens,
        costUsd,
        await getUsdBrl(),
      ]
    );
  } catch (error) {
    console.error(`[${clinic.id}] Erro ao registrar uso:`, error.message);
  }
}

module.exports = {
  record,
};
