'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveQuoteAction } from '../../actions';
import { centsToInput, formatBRL, formatPhone, itemsTotal, parseCents } from '../../../lib/format';

let nextKey = 0;
const newLine = (description = '') => ({ key: nextKey++, description, quantity: '1', value: '' });

function lineTotal(line) {
  const quantity = Number(line.quantity.replace(',', '.')) || 0;
  return Math.round(quantity * (parseCents(line.value) ?? 0));
}

// Campos controlados: um erro de validacao nao apaga o que foi digitado
export default function QuoteForm({ quote, clients, services, initialClient, initialDate, initialService, today }) {
  const [state, action, pending] = useActionState(saveQuoteAction, { error: null });
  const [clientId, setClientId] = useState(String(quote?.client_id ?? initialClient ?? ''));
  const [serviceDate, setServiceDate] = useState(quote?.service_date ?? initialDate ?? today);
  const [complaint, setComplaint] = useState(quote?.complaint ?? '');
  const [notes, setNotes] = useState(quote?.notes ?? '');

  // Itens ja enviados ao cliente nao podem mais ser alterados
  const sent = (quote?.items ?? []).filter((i) => i.send_id !== null);
  const [lines, setLines] = useState(() => {
    const existing = (quote?.items ?? [])
      .filter((i) => i.send_id === null)
      .map((i) => ({ key: nextKey++, description: i.description, quantity: String(i.quantity).replace('.', ','), value: centsToInput(i.unit_cents) }));
    return existing.length ? existing : [newLine(initialService ?? '')];
  });

  const update = (key, field, value) => setLines((all) => all.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0) + itemsTotal(sent);

  return (
    <form action={action}>
      {quote && <input type="hidden" name="id" value={quote.id} />}
      <input type="hidden" name="items" value={JSON.stringify(lines.map(({ description, quantity, value }) => ({ description, quantity, value })))} />

      <section className="card grid-form">
        <label className="span-2">
          Cliente
          {quote?.sends.length > 0 && <input type="hidden" name="client_id" value={clientId} />}
          <select name="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={quote?.sends.length > 0} required>
            <option value="">Selecione…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {formatPhone(c.phone)}</option>
            ))}
          </select>
          {!quote && <span className="hint">Não está na lista? <Link href="/clientes/novo">Cadastre o cliente</Link> primeiro.</span>}
        </label>
        <label>
          Data do atendimento
          <input type="date" name="service_date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required />
        </label>
        <label className="span-3">
          Queixa ou motivo
          <textarea name="complaint" rows="2" value={complaint} onChange={(e) => setComplaint(e.target.value)} />
        </label>
        <label className="span-3">
          Observações
          <span className="hint">Aparecem para o cliente no orçamento.</span>
          <textarea name="notes" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Tratamentos</h2>
          <button type="button" className="secondary" onClick={() => setLines((all) => [...all, newLine()])}>Adicionar</button>
        </div>
        <div className="items-head">
          <span>Descrição</span>
          <span>Qtd</span>
          <span>Valor unitário (R$)</span>
          <span className="num">Total</span>
          <span />
        </div>
        {lines.map((l) => (
          <div key={l.key} className="items-row">
            <input aria-label="Descrição" list="services" value={l.description} onChange={(e) => update(l.key, 'description', e.target.value)} />
            <input aria-label="Quantidade" inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, 'quantity', e.target.value)} />
            <input aria-label="Valor unitário" inputMode="decimal" placeholder="0,00" value={l.value} onChange={(e) => update(l.key, 'value', e.target.value)} />
            <span className="num">{formatBRL(lineTotal(l))}</span>
            <button type="button" className="secondary" aria-label="Remover item" onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}>✕</button>
          </div>
        ))}
      </section>
      <datalist id="services">
        {services.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {sent.length > 0 && (
        <section className="card">
          <h2>Já enviados ao cliente</h2>
          <p className="muted small">Estes itens não mudam mais. Para alterar os que aguardam aprovação, cancele o envio no atendimento.</p>
          <ul className="sent-list">
            {sent.map((i) => (
              <li key={i.id}>
                <span>{i.description}</span>
                <span className="num">{formatBRL(Math.round(i.quantity * i.unit_cents))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.error && <div className="alert error">{state.error}</div>}
      <div className="form-footer">
        <button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar atendimento'}</button>
        <Link href={quote ? `/atendimentos/${quote.id}` : '/atendimentos'}>Cancelar</Link>
        <strong className="form-total">Total {formatBRL(total)}</strong>
      </div>
    </form>
  );
}
