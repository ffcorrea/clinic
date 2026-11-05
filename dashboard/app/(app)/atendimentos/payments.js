import { addPaymentAction, deletePaymentAction } from '../../actions';
import { PAYMENT_METHODS, centsToInput, formatBRL, formatDate, itemTotal } from '../../../lib/format';
import { today } from '../../../lib/time';

// Pagamentos das partes aceitas: valor livre ou de um item, em uma ou varias vezes
export default function Payments({ quote, acceptedItems }) {
  const missing = quote.approved_cents - quote.paid_cents;
  const paidItems = new Set(quote.payments.map((p) => p.item_id));
  const payableItems = acceptedItems.filter((i) => !paidItems.has(i.id) && itemTotal(i) > 0 && itemTotal(i) <= missing);

  return (
    <section className="card">
      <h2>Pagamentos</h2>
      <dl className="pay-summary">
        <div>
          <dt>Aprovado</dt>
          <dd>{formatBRL(quote.approved_cents)}</dd>
        </div>
        <div>
          <dt>Pago</dt>
          <dd>{formatBRL(quote.paid_cents)}</dd>
        </div>
        <div>
          <dt>Falta</dt>
          <dd>{formatBRL(missing)}</dd>
        </div>
      </dl>

      {quote.payments.length > 0 && (
        <ul className="pay-list">
          {quote.payments.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{formatBRL(p.amount_cents)}</strong>
                <p className="muted small">{formatDate(p.paid_on)} · {p.method}{p.note ? ` · ${p.note}` : ''}</p>
              </div>
              <form action={deletePaymentAction}>
                <input type="hidden" name="quote_id" value={quote.id} />
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="secondary danger" aria-label={`Excluir pagamento de ${formatBRL(p.amount_cents)}`}>Excluir</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {missing > 0 ? (
        <form action={addPaymentAction} className="pay-form">
          <input type="hidden" name="quote_id" value={quote.id} />
          {payableItems.length > 0 && (
            <label>
              Referente a
              <select name="item_id" defaultValue="">
                <option value="">Valor livre</option>
                {payableItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.description} · {formatBRL(itemTotal(i))}</option>
                ))}
              </select>
              <span className="hint">Escolhendo um item, vale o valor dele.</span>
            </label>
          )}
          <label>
            Valor (R$)
            <input name="amount" inputMode="decimal" defaultValue={centsToInput(missing)} />
          </label>
          <label>
            Data
            <input type="date" name="paid_on" max={today()} defaultValue={today()} required />
          </label>
          <label>
            Forma de pagamento
            <select name="method" defaultValue="" required>
              <option value="">Selecione…</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Observação
            <input name="note" maxLength="255" placeholder="Ex.: entrada, 2ª parcela" />
          </label>
          <button type="submit">Registrar pagamento</button>
        </form>
      ) : (
        <p className="alert ok">Tudo o que o cliente aprovou está pago.</p>
      )}
    </section>
  );
}
