'use client';

import { useState } from 'react';

// Tabela de tratamentos: nome + duracao (min). Duracao vazia = duracao padrao da clinica.
export default function ServicesEditor({ initial }) {
  const [rows, setRows] = useState(() => (initial.length ? initial : [{ name: '', minutes: null }]).map((s, i) => ({ ...s, key: i })));
  const [nextKey, setNextKey] = useState(rows.length);

  const add = () => {
    setRows([...rows, { name: '', minutes: null, key: nextKey }]);
    setNextKey(nextKey + 1);
  };
  const remove = (key) => setRows(rows.length > 1 ? rows.filter((r) => r.key !== key) : rows);

  return (
    <div className="services-editor">
      <div className="services-head">
        <span>Tratamento</span>
        <span>Duração (min)</span>
        <span />
      </div>
      {rows.map((row) => (
        <div key={row.key} className="services-row">
          <input name="service_name" defaultValue={row.name} placeholder="Ex: Clareamento dental" aria-label="Tratamento" />
          <input
            name="service_minutes"
            type="number"
            min="5"
            max="600"
            step="5"
            defaultValue={row.minutes || ''}
            placeholder="Padrão"
            aria-label="Duração em minutos"
          />
          <button type="button" className="secondary" onClick={() => remove(row.key)} aria-label="Remover tratamento" title="Remover">
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={add}>
        + Adicionar tratamento
      </button>
    </div>
  );
}
