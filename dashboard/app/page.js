import { getCurrentUsdBrl } from '../lib/fx';
import { GRANULARITIES, getUsage, groupBy, listClinics, parseFilters, sumRows } from '../lib/usage';

export const dynamic = 'force-dynamic';

const GRANULARITY_LABEL = { day: 'Dia', week: 'Semana', month: 'Mês' };
const PERIOD_TITLE = { day: 'Por dia', week: 'Por semana', month: 'Por mês' };

const int = new Intl.NumberFormat('pt-BR');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const rateFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4 });

function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return int.format(n);
}

function periodLabel(iso, granularity) {
  const d = new Date(`${iso}T12:00:00Z`);
  const opts = { timeZone: 'UTC' };
  if (granularity === 'month') {
    return d.toLocaleDateString('pt-BR', { ...opts, month: 'long', year: 'numeric' });
  }
  const day = d.toLocaleDateString('pt-BR', { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' });
  if (granularity === 'week') return `Semana de ${day}`;
  return `${day} · ${d.toLocaleDateString('pt-BR', { ...opts, weekday: 'short' })}`;
}

function hrefWith(filters, changes) {
  const params = new URLSearchParams();
  const next = { ...filters, ...changes };
  for (const [k, v] of Object.entries({ g: next.granularity, clinic: next.clinic, from: next.from, to: next.to })) {
    if (v) params.set(k, v);
  }
  return `?${params}`;
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

function UsageTable({ title, groups, firstColumn, maxBrl }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{firstColumn}</th>
              <th className="num">Recebidas</th>
              <th className="num">Respostas</th>
              <th className="num">Tokens entrada</th>
              <th className="num">Tokens saída</th>
              <th className="num">US$</th>
              <th className="num">R$</th>
              <th className="bar-col" aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <td>
                  {g.label}
                  {g.errors > 0 && <span className="badge" title="Atendimentos com erro (mensagem de fallback)">{g.errors} erro{g.errors > 1 ? 's' : ''}</span>}
                </td>
                <td className="num">{int.format(g.messages_in)}</td>
                <td className="num">{int.format(g.messages_out)}</td>
                <td className="num">{int.format(g.prompt_tokens)}</td>
                <td className="num">{int.format(g.completion_tokens)}</td>
                <td className="num">{usd.format(g.cost_usd)}</td>
                <td className="num strong">{brl.format(g.cost_brl)}</td>
                <td className="bar-col">
                  <div className="bar" style={{ width: `${maxBrl ? (g.cost_brl / maxBrl) * 100 : 0}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function Page({ searchParams }) {
  const filters = parseFilters(await searchParams);
  const fx = await getCurrentUsdBrl();

  let rows, clinics;
  try {
    [rows, clinics] = await Promise.all([getUsage(filters, fx?.rate), listClinics()]);
  } catch (error) {
    return (
      <main>
        <h1>Painel de uso</h1>
        <div className="card error">Não foi possível ler o banco: {error.message}</div>
      </main>
    );
  }

  const total = sumRows(rows);
  const byClinic = groupBy(rows, 'clinic_id', 'clinic_name').sort((a, b) => b.cost_brl - a.cost_brl);
  const byPeriod = groupBy(rows, 'period', 'period').map((g) => ({ ...g, label: periodLabel(g.key, filters.granularity) }));
  const avgBrl = total.messages_out ? total.cost_brl / total.messages_out : 0;

  return (
    <main>
      <header className="top">
        <div>
          <h1>Painel de uso</h1>
          <p className="muted">Mensagens, tokens e custo do bot por consultório</p>
        </div>
        <div className="fx">
          <span className="muted">Dólar hoje</span>
          <strong>{fx ? `R$ ${rateFmt.format(fx.rate)}` : 'indisponível'}</strong>
        </div>
      </header>

      <form className="filters" method="get">
        <nav className="segmented" aria-label="Agrupar por">
          {GRANULARITIES.map((g) => (
            <a key={g} href={hrefWith(filters, { granularity: g, from: '', to: '' })} className={g === filters.granularity ? 'active' : ''}>
              {GRANULARITY_LABEL[g]}
            </a>
          ))}
        </nav>
        <input type="hidden" name="g" value={filters.granularity} />
        <label>
          Consultório
          <select name="clinic" defaultValue={filters.clinic}>
            <option value="">Todos</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </label>
        <label>
          De
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          Até
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <button type="submit">Aplicar</button>
      </form>

      <section className="kpis">
        <Kpi label="Mensagens recebidas" value={int.format(total.messages_in)} hint={`${int.format(total.events)} atendimentos`} />
        <Kpi label="Respostas enviadas" value={int.format(total.messages_out)} hint={total.errors ? `${int.format(total.errors)} com erro` : 'sem erros'} />
        <Kpi label="Tokens" value={compact(total.prompt_tokens + total.completion_tokens)} hint={`${compact(total.prompt_tokens)} entrada · ${compact(total.completion_tokens)} saída`} />
        <Kpi label="Custo em dólar" value={usd.format(total.cost_usd)} />
        <Kpi label="Custo em reais" value={brl.format(total.cost_brl)} hint={`${brl.format(avgBrl)} por resposta`} />
      </section>

      {rows.length === 0 ? (
        <div className="card empty">Nenhum atendimento registrado neste período.</div>
      ) : (
        <>
          <UsageTable title="Por consultório" groups={byClinic} firstColumn="Consultório" maxBrl={Math.max(...byClinic.map((g) => g.cost_brl))} />
          <UsageTable title={PERIOD_TITLE[filters.granularity]} groups={byPeriod} firstColumn="Período" maxBrl={Math.max(...byPeriod.map((g) => g.cost_brl))} />
        </>
      )}

      <p className="muted footnote">
        R$ calculado com a cotação do dólar no momento de cada atendimento (AwesomeAPI). Semanas começam na segunda-feira; horário de Brasília.
      </p>
    </main>
  );
}
