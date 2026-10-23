const axios = require('axios');
const { Pool } = require('pg');

// Registra no Postgres (Supabase) o uso de cada atendimento, para o painel em dashboard/.
// Sem DATABASE_URL o registro fica desligado e o bot funciona normalmente.
const DATABASE_URL = process.env.DATABASE_URL;

// Preco do modelo em US$ por 1 milhao de tokens (conferir na tabela da DigitalOcean)
const PRICE_INPUT_PER_MTOK = parseFloat(process.env.PRICE_INPUT_PER_MTOK || '1');
const PRICE_OUTPUT_PER_MTOK = parseFloat(process.env.PRICE_OUTPUT_PER_MTOK || '5');

// Cotacao do dolar (AwesomeAPI, sem chave), guardada em cada registro
const FX_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
const FX_CACHE_MS = 60 * 60 * 1000;

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 })
  : null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS usage_events (
    id                bigserial PRIMARY KEY,
    created_at        timestamptz NOT NULL DEFAULT now(),
    clinic_id         text NOT NULL,
    clinic_name       text,
    phone             text,
    kind              text NOT NULL,           -- reply | error | unsupported_media
    model             text,
    messages_in       integer NOT NULL DEFAULT 0,
    messages_out      integer NOT NULL DEFAULT 0,
    prompt_tokens     integer NOT NULL DEFAULT 0,
    completion_tokens integer NOT NULL DEFAULT 0,
    cost_usd          numeric(12, 6) NOT NULL DEFAULT 0,
    usd_brl           numeric(10, 4)
  );
  CREATE INDEX IF NOT EXISTS usage_events_created_at_idx ON usage_events (created_at);
  CREATE INDEX IF NOT EXISTS usage_events_clinic_idx ON usage_events (clinic_id, created_at);
  -- Bloqueia a API publica do Supabase (anon key); a conexao direta do postgres nao e afetada
  ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
`;

const ready = pool
  ? pool.query(SCHEMA).then(
      () => console.log('Registro de uso ativo (usage_events)'),
      (error) => console.error('Erro ao preparar usage_events:', error.message)
    )
  : Promise.resolve();

let fx = { rate: null, fetchedAt: 0 };

async function getUsdBrl() {
  if (fx.rate && Date.now() - fx.fetchedAt < FX_CACHE_MS) return fx.rate;

  try {
    const { data } = await axios.get(FX_URL, { timeout: 5000 });
    const rate = parseFloat(data?.USDBRL?.bid);
    if (rate > 0) fx = { rate, fetchedAt: Date.now() };
  } catch (error) {
    console.error('Erro ao buscar cotacao do dolar:', error.message);
  }

  // Se a API falhar, usa a ultima cotacao conhecida (ou null)
  return fx.rate;
}

/**
 * Grava um atendimento. Nunca lanca erro: falha no registro nao pode afetar o paciente.
 * @param {Object} clinic - consultorio do clinic.service
 * @param {Object} event - { phone, kind, messagesIn, messagesOut, usage }
 *   usage: objeto "usage" da resposta do modelo ({ prompt_tokens, completion_tokens })
 */
async function record(clinic, { phone, kind, messagesIn = 0, messagesOut = 0, usage }) {
  if (!pool) return;

  try {
    await ready;

    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const costUsd =
      (promptTokens * PRICE_INPUT_PER_MTOK + completionTokens * PRICE_OUTPUT_PER_MTOK) / 1e6;

    await pool.query(
      `INSERT INTO usage_events
        (clinic_id, clinic_name, phone, kind, model, messages_in, messages_out,
         prompt_tokens, completion_tokens, cost_usd, usd_brl)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
