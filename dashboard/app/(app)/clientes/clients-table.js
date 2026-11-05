'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatPhone, maskCpf, matchesSearch } from '../../../lib/format';

const SOURCE_LABEL = { agent: 'Bot', import: 'Agenda' };

export default function ClientsTable({ clients }) {
  const [search, setSearch] = useState('');
  const visible = clients.filter((c) => matchesSearch([c.name, c.phone, c.cpf], search));

  return (
    <>
      <div className="search">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou CPF…" aria-label="Buscar cliente" />
        {search && <span className="muted small">{visible.length} de {clients.length}</span>}
      </div>
      {visible.length === 0 ? (
        <div className="card empty">{search ? `Nenhum cliente encontrado para “${search}”.` : 'Nenhum cliente cadastrado ainda.'}</div>
      ) : (
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>CPF</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/clientes/${c.id}`} className="strong">{c.name}</Link></td>
                  <td>{formatPhone(c.phone)}</td>
                  <td>{c.cpf ? maskCpf(c.cpf) : '—'}</td>
                  <td className="muted">{SOURCE_LABEL[c.source] || 'Recepção'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
