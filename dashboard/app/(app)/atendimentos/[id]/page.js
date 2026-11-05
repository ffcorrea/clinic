import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cancelSendAction } from '../../../actions';
import Flash from '../../../flash';
import CopyLink from '../copy-link';
import Payments from '../payments';
import SendItems from '../send-items';
import { requireSession } from '../../../../lib/auth';
import { getClinic } from '../../../../lib/clinics';
import { currentClinicId } from '../../../../lib/current';
import { STATUS_LABEL, formatBRL, formatDate, formatPhone, partName, splitParts } from '../../../../lib/format';
import { getQuote, listAcceptances } from '../../../../lib/quotes';
import { toLocal } from '../../../../lib/time';

function formatDateTime(date) {
  if (!date) return null;
  const local = toLocal(date);
  return `${formatDate(local.date)} ${local.time}`;
}

// Endereco publico do link: o painel roda em /painel (next.config.mjs)
async function publicLink(token) {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}/painel/orcamento/${token}`;
}

export default async function QuotePage({ params, searchParams }) {
  const user = await requireSession();
  const { id } = await params;
  const clinicId = await currentClinicId(user);
  const quote = clinicId && (await getQuote(clinicId, Number(id)));
  if (!quote) notFound();
  const [clinic, acceptances] = await Promise.all([getClinic(clinicId), listAcceptances(quote.id)]);

  const { client } = quote;
  const { parts, pending, unsent } = splitParts(quote);
  const manyParts = parts.length > 1;
  const partNumber = new Map(parts.map((p) => [p.id, p.part]));
  const link = quote.token ? await publicLink(quote.token) : null;

  const firstName = client.name.split(' ')[0];
  const message =
    link && pending
      ? pending.part === 1
        ? `Olá, ${firstName}! Segue o seu orçamento na ${clinic.name}, no valor de ${formatBRL(pending.total_cents)}.\n\nPara conferir e aprovar, acesse: ${link}`
        : `Olá, ${firstName}! Segue mais uma parte do seu orçamento na ${clinic.name} (${partName(pending.part)}), no valor de ${formatBRL(pending.total_cents)}.\n\nPara conferir e aprovar, acesse: ${link}`
      : '';

  const steps = [
    { label: 'Orçamento', when: quote.created_at, done: true },
    ...(parts.length === 0
      ? [
          { label: 'Enviado ao cliente', done: false },
          { label: 'Aceito pelo cliente', done: false },
        ]
      : parts.flatMap((p) => {
          const name = manyParts ? `${partName(p.part)} (${formatBRL(p.total_cents)})` : null;
          return [
            { label: name ? `${name} enviada` : 'Enviado ao cliente', when: p.sent_at, done: true },
            { label: name ? `${name} aceita` : 'Aceito pelo cliente', when: p.accepted_at, done: Boolean(p.accepted_at) },
          ];
        })),
    {
      label:
        quote.status === 'pago'
          ? `Pago (${quote.payment_methods})`
          : quote.paid_cents > 0
            ? `Pago parcialmente: ${formatBRL(quote.paid_cents)} de ${formatBRL(quote.approved_cents)}`
            : 'Pago',
      when: quote.paid_at,
      done: Boolean(quote.paid_at),
    },
  ];

  return (
    <main>
      <header className="top">
        <div>
          <h1>Atendimento #{quote.id}</h1>
          <p className="muted">
            {formatDate(quote.service_date)} · <span className={`tag quote-${quote.status}`}>{STATUS_LABEL[quote.status]}</span>
          </p>
        </div>
        <div className="row-actions">
          {link && <a href={link} target="_blank" rel="noreferrer" className="button secondary">Ver como o cliente vê</a>}
          <Link href={`/atendimentos/${quote.id}/editar`} className="button secondary">{parts.length > 0 ? 'Editar / adicionar itens' : 'Editar'}</Link>
        </div>
      </header>
      <Flash params={await searchParams} />

      <div className="columns">
        <div>
          <section className="card">
            <dl className="details cols">
              <div>
                <dt>Cliente</dt>
                <dd><Link href={`/clientes/${client.id}`} className="strong">{client.name}</Link></dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{formatPhone(client.phone)}</dd>
              </div>
              {quote.complaint && (
                <div className="wide-field">
                  <dt>Queixa ou motivo</dt>
                  <dd className="pre-line">{quote.complaint}</dd>
                </div>
              )}
              {quote.notes && (
                <div className="wide-field">
                  <dt>Observações</dt>
                  <dd className="pre-line">{quote.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="card">
            <SendItems
              // key: depois de editar ou enviar, a selecao recomeca com todos marcados
              key={`${unsent.map((i) => i.id).join(',')}|${pending?.id ?? ''}`}
              quoteId={quote.id}
              items={quote.items}
              parts={parts}
              payments={quote.payments}
            />
          </section>
        </div>

        <aside>
          <section className="card">
            <h2>Andamento</h2>
            <ol className="timeline">
              {steps.map((s) => (
                <li key={s.label} className={s.done ? 'done' : ''}>
                  <span>{s.label}</span>
                  {s.when && <small className="muted">{formatDateTime(s.when)}</small>}
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h2>Envio ao cliente</h2>
            {pending ? (
              <div className="send-panel">
                <p className="alert info">
                  {pending.part === 1 ? 'Orçamento' : partName(pending.part)} aguardando aprovação: {pending.items.length} {pending.items.length === 1 ? 'item' : 'itens'}, <strong>{formatBRL(pending.total_cents)}</strong>.
                </p>
                <CopyLink link={link} />
                <a href={`https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="button">Enviar pelo WhatsApp</a>
                <form action={cancelSendAction}>
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <button type="submit" className="secondary">Cancelar envio e editar itens</button>
                </form>
              </div>
            ) : (
              <div className="send-panel">
                {link && <CopyLink link={link} />}
                <p className="muted small">
                  {unsent.length > 0
                    ? 'Marque no quadro de itens o que vai para aprovação e clique em Enviar.'
                    : link
                      ? 'Todos os itens já foram enviados. Para pedir aprovação de mais itens, edite o atendimento.'
                      : 'Adicione tratamentos para enviar ao cliente.'}
                </p>
              </div>
            )}
          </section>

          {quote.approved_cents > 0 && <Payments quote={quote} acceptedItems={parts.filter((p) => p.accepted_at).flatMap((p) => p.items)} />}

          {acceptances.map((a) => (
            <section key={a.id} className="card">
              <h2>Comprovante do aceite{manyParts && partNumber.has(a.send_id) ? ` · ${partName(partNumber.get(a.send_id))}` : ''}</h2>
              <dl className="receipt">
                {[
                  ['Data e hora', formatDateTime(a.accepted_at)],
                  ['IP', a.ip],
                  ['Plataforma', a.platform],
                  ['Tela', a.screen],
                  ['Fuso horário', a.timezone],
                  ['Idioma', a.language],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              {a.user_agent && <p className="muted small receipt-ua">{a.user_agent}</p>}
              <p className="muted small">Código de verificação: <code>{a.content_hash.slice(0, 16)}</code></p>
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}
