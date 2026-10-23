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
  const { rows } = await pool.query(
    `SELECT clinic_id AS id, (array_agg(clinic_name ORDER BY created_at DESC))[1] AS name
       FROM usage_events GROUP BY clinic_id ORDER BY name`
  );
  return rows;
}

// Uma linha por periodo x consultorio. O custo em R$ usa o dolar gravado em cada
// registro (dolar do dia do atendimento); sem cotacao gravada, usa a atual.
export async function getUsage({ granularity, from, to, clinic }, currentRate) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc($1, created_at AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS period,
            clinic_id,
            (array_agg(clinic_name ORDER BY created_at DESC))[1] AS clinic_name,
            count(*)::int                          AS events,
            coalesce(sum(messages_in), 0)::int     AS messages_in,
            coalesce(sum(messages_out), 0)::int    AS messages_out,
            coalesce(sum(prompt_tokens), 0)::bigint     AS prompt_tokens,
            coalesce(sum(completion_tokens), 0)::bigint AS completion_tokens,
            coalesce(sum(cost_usd), 0)::float8     AS cost_usd,
            coalesce(sum(cost_usd * coalesce(usd_brl, $5)), 0)::float8 AS cost_brl,
            count(*) FILTER (WHERE kind = 'error')::int AS errors
       FROM usage_events
      WHERE created_at >= ($2::date)::timestamp AT TIME ZONE '${TZ}'
        AND created_at <  ($3::date + 1)::timestamp AT TIME ZONE '${TZ}'
        AND ($4 = '' OR clinic_id = $4)
      GROUP BY 1, 2
      ORDER BY 1 DESC, 3`,
    [granularity, from, to, clinic, currentRate ?? 0]
  );

  return rows.map((r) => ({
    ...r,
    prompt_tokens: Number(r.prompt_tokens),
    completion_tokens: Number(r.completion_tokens),
  }));
}

const METRICS = ['events', 'messages_in', 'messages_out', 'prompt_tokens', 'completion_tokens', 'cost_usd', 'cost_brl', 'errors'];

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
