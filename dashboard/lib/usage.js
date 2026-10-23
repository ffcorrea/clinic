import { pool } from './db';

const TZ = 'America/Sao_Paulo';
export const GRANULARITIES = ['day', 'week', 'month'];

// Janela padrao de cada visao, contada a partir de hoje
const DEFAULT_SPAN_DAYS = { day: 30, week: 7 * 12, month: 365 };

function todayInTz() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parseFilters(params) {
  const granularity = GRANULARITIES.includes(params.g) ? params.g : 'day';
  const to = isIsoDate(params.to) ? params.to : todayInTz();
  const from = isIsoDate(params.from) ? params.from : addDays(to, -(DEFAULT_SPAN_DAYS[granularity] - 1));
  const clinic = params.clinic || '';
  return { granularity, from, to, clinic };
}

export async function listClinics() {
  const [rows] = await pool.query(
    `SELECT clinic_id AS id, MAX(clinic_name) AS name
       FROM usage_events GROUP BY clinic_id ORDER BY name`
  );
  return rows;
}

// Inicio de cada periodo no horario de Brasilia (created_at e gravado em UTC).
// A semana comeca na segunda-feira.
const LOCAL = `CONVERT_TZ(created_at, '+00:00', '${TZ}')`;
const PERIOD_SQL = {
  day: `DATE(${LOCAL})`,
  week: `DATE(${LOCAL}) - INTERVAL WEEKDAY(${LOCAL}) DAY`,
  month: `DATE_FORMAT(${LOCAL}, '%Y-%m-01')`,
};

const NUMERIC = ['events', 'messages_in', 'messages_out', 'prompt_tokens', 'completion_tokens', 'cost_usd', 'cost_brl', 'errors'];

// Uma linha por periodo x consultorio. O custo em R$ usa o dolar gravado em cada
// registro (dolar do dia do atendimento); sem cotacao gravada, usa a atual.
export async function getUsage({ granularity, from, to, clinic }, currentRate) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(${PERIOD_SQL[granularity]}, '%Y-%m-%d') AS period,
            clinic_id,
            MAX(clinic_name)                 AS clinic_name,
            COUNT(*)                         AS events,
            COALESCE(SUM(messages_in), 0)    AS messages_in,
            COALESCE(SUM(messages_out), 0)   AS messages_out,
            COALESCE(SUM(prompt_tokens), 0)  AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
            COALESCE(SUM(cost_usd), 0)       AS cost_usd,
            COALESCE(SUM(cost_usd * COALESCE(usd_brl, ?)), 0) AS cost_brl,
            SUM(kind = 'error')              AS errors
       FROM usage_events
      WHERE created_at >= CONVERT_TZ(CAST(? AS DATETIME), '${TZ}', '+00:00')
        AND created_at <  CONVERT_TZ(CAST(? AS DATETIME) + INTERVAL 1 DAY, '${TZ}', '+00:00')
        AND (? = '' OR clinic_id = ?)
      GROUP BY period, clinic_id
      ORDER BY period DESC, clinic_name`,
    [currentRate ?? 0, from, to, clinic, clinic]
  );

  // O mysql2 devolve SUM/DECIMAL como texto
  return rows.map((r) => ({
    ...r,
    ...Object.fromEntries(NUMERIC.map((m) => [m, Number(r[m])])),
  }));
}

const METRICS = NUMERIC;

export function sumRows(rows) {
  const total = Object.fromEntries(METRICS.map((m) => [m, 0]));
  for (const r of rows) for (const m of METRICS) total[m] += r[m];
  return total;
}

export function groupBy(rows, key, label) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r[key])) groups.set(r[key], { key: r[key], label: r[label], rows: [] });
    groups.get(r[key]).rows.push(r);
  }
  return [...groups.values()].map((g) => ({ ...g, ...sumRows(g.rows) }));
}
