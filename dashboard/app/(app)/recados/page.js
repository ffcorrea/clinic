import Link from 'next/link';
import { resolveRequest } from '../../actions';
import Flash from '../../flash';
import { requireSession } from '../../../lib/auth';
import { clientsByPhone } from '../../../lib/clients';
import { currentClinicId } from '../../../lib/current';
import { listRequests, REASON_LABEL } from '../../../lib/requests';

export default async function RequestsPage({ searchParams }) {
  const user = await requireSession();
  const params = await searchParams;
  const clinicId = await currentClinicId(user);
  if (!clinicId) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;

  const showDone = params.ver === 'resolvidos';
  const requests = await listRequests(clinicId, showDone ? 'done' : 'open');
  const back = showDone ? '/recados?ver=resolvidos' : '/recados';
  const clientsOf = await clientsByPhone(clinicId, requests.map((r) => r.phone).filter(Boolean));

  return (
    <main>
      <header className="top">
        <div>
          <h1>Recados</h1>
          <p className="muted">Pedidos que o bot anotou para a recepção responder (valores, procedimentos, convênio, urgências).</p>
        </div>
        <nav className="segmented" aria-label="Filtro">
          <Link href="/recados" className={showDone ? '' : 'active'}>Em aberto</Link>
          <Link href="/recados?ver=resolvidos" className={showDone ? 'active' : ''}>Resolvidos</Link>
        </nav>
      </header>

      <Flash params={params} />

      {requests.length === 0 ? (
        <div className="card empty">{showDone ? 'Nenhum recado resolvido ainda.' : 'Nenhum recado em aberto. 🎉'}</div>
      ) : (
        <section className="card requests">
          {requests.map((r) => {
            const clients = clientsOf[r.phone] || [];
            return (
            <div key={r.id} className={`request reason-${r.reason}`}>
              <div className="request-main">
                <div className="request-head">
                  <span className={`tag reason-${r.reason}`}>{REASON_LABEL[r.reason] || r.reason}</span>
                  <strong>{r.patient_name || clients[0]?.name || 'Paciente'}</strong>
                  <span className="muted small">{r.when}</span>
                </div>
                {r.details && <p className="request-details">{r.details}</p>}
                {r.phone && (
                  <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noreferrer" className="small">
                    Responder no WhatsApp · {r.phone}
                  </a>
                )}
                {r.phone && (
                  <div className="row-links small">
                    {clients.map((c) => (
                      <span key={c.id}>
                        <Link href={`/clientes/${c.id}`}>{c.name}</Link>
                        {' · '}
                        <Link href={`/atendimentos/novo?cliente=${c.id}`}>Novo atendimento</Link>
                      </span>
                    ))}
                    {clients.length === 0 && <Link href={`/clientes/novo?${new URLSearchParams({ telefone: r.phone, nome: r.patient_name || '' })}`}>Cadastrar cliente</Link>}
                  </div>
                )}
              </div>
              <form action={resolveRequest}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="status" value={showDone ? 'open' : 'done'} />
                <input type="hidden" name="back" value={back} />
                <button type="submit" className="secondary">{showDone ? 'Reabrir' : 'Resolvido'}</button>
              </form>
            </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
