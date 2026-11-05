import Link from 'next/link';
import Flash from '../../flash';
import QuotesTable from './quotes-table';
import { requireSession } from '../../../lib/auth';
import { currentClinicId } from '../../../lib/current';
import { STATUS_LABEL } from '../../../lib/format';
import { countByStatus, listQuotes } from '../../../lib/quotes';

// /atendimentos?status=orcamento|enviado|aceito|pago
export default async function QuotesPage({ searchParams }) {
  const user = await requireSession();
  const params = await searchParams;
  const clinicId = await currentClinicId(user);
  if (!clinicId) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;

  const status = STATUS_LABEL[params.status] ? params.status : null;
  const [quotes, counts] = await Promise.all([listQuotes(clinicId, { status }), countByStatus(clinicId)]);

  return (
    <main>
      <header className="top">
        <div>
          <h1>Atendimentos</h1>
          <p className="muted">Orçamentos enviados ao cliente para aceite online e pagamentos.</p>
        </div>
        <Link href="/atendimentos/novo" className="button">Novo atendimento</Link>
      </header>
      <Flash params={params} />
      <nav className="segmented filter" aria-label="Status">
        <Link href="/atendimentos" className={status ? '' : 'active'}>Todos</Link>
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <Link key={key} href={`/atendimentos?status=${key}`} className={status === key ? 'active' : ''}>
            {label} ({counts[key] || 0})
          </Link>
        ))}
      </nav>
      <QuotesTable key={status || 'todos'} quotes={quotes} />
    </main>
  );
}
