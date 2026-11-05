import { notFound } from 'next/navigation';
import AcceptForm from './accept-form';
import PrintButton from './print-button';
import QuoteItems from '../../(app)/atendimentos/quote-items';
import { getClinic } from '../../../lib/clinics';
import { formatBRL, formatDate, partName, splitParts } from '../../../lib/format';
import { getQuoteByToken } from '../../../lib/quotes';
import { toLocal } from '../../../lib/time';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Seu orçamento', robots: { index: false, follow: false } };

// Pagina publica do cliente: quem tem o link ve o orcamento e aceita, sem login.
// So mostra o que ja foi enviado; itens nao enviados ficam de fora.
export default async function PublicQuotePage({ params }) {
  const { token } = await params;
  const quote = await getQuoteByToken(token);
  if (!quote) notFound();
  const clinic = await getClinic(quote.clinic_id);
  const { parts, pending } = splitParts(quote);
  const manyParts = parts.length > 1;

  return (
    <main className="public-quote">
      <div className="no-print public-actions">
        <PrintButton />
      </div>
      <article className="card">
        <header className="public-head">
          <strong className="brand">{clinic.name}</strong>
          <div>
            <p className="strong">Orçamento #{quote.id}</p>
            <p className="muted">{formatDate(quote.service_date)}</p>
          </div>
        </header>

        <dl className="details">
          <div>
            <dt>Cliente</dt>
            <dd className="strong">{quote.client.name}</dd>
          </div>
          {quote.complaint && (
            <div>
              <dt>Queixa ou motivo</dt>
              <dd className="pre-line">{quote.complaint}</dd>
            </div>
          )}
          {quote.notes && (
            <div>
              <dt>Observações</dt>
              <dd className="pre-line">{quote.notes}</dd>
            </div>
          )}
        </dl>

        {manyParts && pending && <p className="alert info no-print">Há uma nova parte do orçamento ({partName(pending.part)}) aguardando a sua aprovação.</p>}

        {parts.map((p) => (
          <section key={p.id} className={manyParts ? 'public-part' : ''}>
            {manyParts && (
              <h2>
                {partName(p.part)} <span className="muted small">enviada em {formatDate(toLocal(p.sent_at).date)}</span>
              </h2>
            )}
            <QuoteItems items={p.items} totalLabel={manyParts ? `Total da ${partName(p.part)}` : 'Total'} />
            {p.accepted_at ? (
              <p className="alert ok public-accepted">
                {manyParts ? `${partName(p.part)} aceita` : 'Orçamento aceito'} em {formatDate(toLocal(p.accepted_at).date)} às {toLocal(p.accepted_at).time}. Obrigado pela confiança!
              </p>
            ) : (
              <div className="no-print">
                <AcceptForm key={p.id} token={token} sendId={p.id} label={manyParts ? `Aceitar ${partName(p.part)}` : 'Aceitar orçamento'} />
              </div>
            )}
          </section>
        ))}

        {manyParts && (
          <div className="quote-total">
            <span>Total aprovado</span>
            <strong>{formatBRL(quote.approved_cents)}</strong>
          </div>
        )}

        {quote.payments.length > 0 && (
          <section className="public-payments">
            <h2>Pagamentos recebidos</h2>
            <ul className="pay-list">
              {quote.payments.map((p) => (
                <li key={p.id}>
                  <span>{formatDate(p.paid_on)} · {p.method}</span>
                  <strong>{formatBRL(p.amount_cents)}</strong>
                </li>
              ))}
            </ul>
            <p className="strong">
              {quote.paid_cents >= quote.approved_cents ? 'Pagamento concluído' : `Saldo a pagar: ${formatBRL(quote.approved_cents - quote.paid_cents)}`}
            </p>
          </section>
        )}

        {parts.length === 0 && <p className="alert info">Este orçamento está sendo revisado pela clínica. Você receberá um novo aviso em breve.</p>}
      </article>
    </main>
  );
}
