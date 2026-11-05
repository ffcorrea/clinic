'use client';

import Link from 'next/link';
import { useState } from 'react';
import { STATUS_LABEL, formatBRL, formatDate, formatPhone, matchesSearch } from '../../../lib/format';

export default function QuotesTable({ quotes }) {
  const [search, setSearch] = useState('');
  const visible = quotes.filter((q) => matchesSearch([`#${q.id}`, q.client_name, q.client_phone], search));

  return (
    <>
      <div className="search">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, cliente ou telefone…" aria-label="Buscar atendimento" />
        {search && <span className="muted small">{visible.length} de {quotes.length}</span>}
      </div>
      {visible.length === 0 ? (
        <div className="card empty">{search ? `Nenhum atendimento encontrado para “${search}”.` : 'Nenhum atendimento aqui.'}</div>
      ) : (
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Telefone</th>
                <th className="num">Total</th>
                <th className="num">Pago</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => (
                <tr key={q.id}>
                  <td><Link href={`/atendimentos/${q.id}`} className="strong">#{q.id}</Link></td>
                  <td>{formatDate(q.service_date)}</td>
                  <td>{q.client_name}</td>
                  <td>{formatPhone(q.client_phone)}</td>
                  <td className="num">{formatBRL(q.total_cents)}</td>
                  <td className="num">{formatBRL(q.paid_cents)}</td>
                  <td><span className={`tag quote-${q.status}`}>{STATUS_LABEL[q.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
