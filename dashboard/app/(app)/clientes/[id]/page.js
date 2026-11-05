import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash from '../../../flash';
import { requireSession } from '../../../../lib/auth';
import { STATUSES } from '../../../../lib/appointments';
import { clientAppointments, getClient } from '../../../../lib/clients';
import { currentClinicId } from '../../../../lib/current';
import { STATUS_LABEL, formatBRL, formatDate, formatPhone, maskCpf } from '../../../../lib/format';
import { listQuotes } from '../../../../lib/quotes';

export default async function ClientPage({ params, searchParams }) {
  const user = await requireSession();
  const { id } = await params;
  const clinicId = await currentClinicId(user);
  const client = clinicId && (await getClient(clinicId, Number(id)));
  if (!client) notFound();
  const [quotes, appointments] = await Promise.all([listQuotes(clinicId, { clientId: client.id }), clientAppointments(clinicId, client.id)]);

  const details = [
    ['Telefone', formatPhone(client.phone)],
    ['CPF', client.cpf ? maskCpf(client.cpf) : '—'],
    ['Nascimento', formatDate(client.birth_date)],
    ['CEP', client.cep || '—'],
    ['Endereço', client.address || '—'],
  ];

  return (
    <main>
      <header className="top">
        <div>
          <h1>{client.name}</h1>
          <p className="muted">
            <a href={`https://wa.me/${client.phone}`} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>
          </p>
        </div>
        <div className="row-actions">
          <Link href={`/clientes/${client.id}/editar`} className="button secondary">Editar</Link>
          <Link href={`/atendimentos/novo?cliente=${client.id}`} className="button">Novo atendimento</Link>
        </div>
      </header>
      <Flash params={await searchParams} />

      <div className="columns">
        <div>
          <section className="card">
            <h2>Atendimentos</h2>
            {quotes.length === 0 ? (
              <p className="muted">Nenhum atendimento para este cliente.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {quotes.map((q) => (
                      <tr key={q.id}>
                        <td><Link href={`/atendimentos/${q.id}`} className="strong">#{q.id}</Link></td>
                        <td>{formatDate(q.service_date)}</td>
                        <td className="num">{formatBRL(q.total_cents)}</td>
                        <td><span className={`tag quote-${q.status}`}>{STATUS_LABEL[q.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card">
            <h2>Consultas</h2>
            {appointments.length === 0 ? (
              <p className="muted">Nenhuma consulta vinculada.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {appointments.map((a) => (
                      <tr key={a.id}>
                        <td><Link href={`/agenda/${a.id}`}>{formatDate(a.date)} {a.time}</Link></td>
                        <td className="wrap">{a.service || '—'}</td>
                        <td className="muted">{STATUSES[a.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <aside className="card">
          <dl className="details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {client.notes && (
              <div>
                <dt>Observações</dt>
                <dd className="pre-line">{client.notes}</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </main>
  );
}
