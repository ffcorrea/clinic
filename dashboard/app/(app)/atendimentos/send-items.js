'use client';

import { useState, useTransition } from 'react';
import { deleteItemAction, sendQuoteAction } from '../../actions';
import QuoteItems from './quote-items';
import { formatBRL, formatDate, itemTotal, itemsTotal, partName } from '../../../lib/format';

/**
 * Todos os itens num quadro so. A coluna Envio mostra a situacao de cada item; os nao enviados tem caixa
 * para escolher o que vai agora para aprovacao.
 */
export default function SendItems({ quoteId, items, parts, payments }) {
  const paymentOf = new Map(payments.filter((p) => p.item_id).map((p) => [p.item_id, p]));
  const partOf = new Map(parts.map((p) => [p.id, p]));
  const unsent = items.filter((i) => i.send_id === null);
  // Com uma parte aguardando aprovacao, so da para enviar depois do aceite (ou cancelando)
  const blocked = parts.some((p) => !p.accepted_at);
  const selectable = new Set(blocked ? [] : unsent.map((i) => i.id));
  const manyParts = parts.length > 1;

  const [marked, setMarked] = useState(() => new Set(selectable));
  const [pending, startTransition] = useTransition();
  const chosen = unsent.filter((i) => selectable.has(i.id) && marked.has(i.id));
  const nextPart = parts.length + 1;

  function toggle(id) {
    setMarked((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function situation(item) {
    const part = partOf.get(item.send_id);
    if (!part) return <span className="tag">Não enviado</span>;
    const suffix = manyParts ? ` · ${partName(part.part)}` : '';
    const payment = paymentOf.get(item.id);
    if (payment) return <span className="tag quote-pago" title={`Pago em ${formatDate(payment.paid_on)} · ${payment.method}`}>Pago{suffix}</span>;
    if (part.accepted_at) return <span className="tag quote-aceito">Aceito{suffix}</span>;
    return <span className="tag quote-enviado">Aguardando{suffix}</span>;
  }

  function actions(item) {
    const part = partOf.get(item.send_id);
    if ((part && !part.accepted_at) || paymentOf.has(item.id)) return null;
    return (
      <button
        type="button"
        className="secondary danger"
        disabled={pending}
        aria-label={`Excluir ${item.description}`}
        onClick={() => {
          if (confirm(`Excluir o item "${item.description}" (${formatBRL(itemTotal(item))})?`)) startTransition(() => deleteItemAction(quoteId, item.id));
        }}
      >
        Excluir
      </button>
    );
  }

  return (
    <div>
      {selectable.size > 0 && <p className="muted small send-hint">Marque os itens que vão para aprovação agora. Os outros podem ser enviados depois.</p>}
      {blocked && unsent.length > 0 && <p className="muted small send-hint">Os itens não enviados poderão ir quando o cliente aprovar a parte que está aguardando (ou cancelando o envio).</p>}
      <QuoteItems
        items={items}
        selection={selectable.size > 0 ? { selectable, marked, toggle } : undefined}
        columns={[...(parts.length > 0 ? [{ title: 'Envio', cell: situation }] : []), { title: '', cell: actions }]}
      />
      {selectable.size > 0 && (
        <div className="send-action">
          <button
            type="button"
            disabled={pending || chosen.length === 0}
            onClick={() => startTransition(() => sendQuoteAction(quoteId, chosen.map((i) => i.id)))}
          >
            {pending
              ? 'Enviando…'
              : chosen.length === 0
                ? 'Marque os itens para enviar'
                : `${nextPart === 1 ? 'Enviar ao cliente' : `Enviar ${partName(nextPart)}`}: ${chosen.length} ${chosen.length === 1 ? 'item' : 'itens'} · ${formatBRL(itemsTotal(chosen))}`}
          </button>
        </div>
      )}
    </div>
  );
}
