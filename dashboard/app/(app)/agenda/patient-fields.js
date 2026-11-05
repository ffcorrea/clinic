'use client';

import Link from 'next/link';
import { useState } from 'react';
import { phoneKey } from '../../../lib/format';

// Nome e telefone do agendamento. Ao digitar o telefone, acha os clientes dele e preenche o nome;
// ao escolher um nome da lista, preenche o telefone. Ao salvar, a consulta fica vinculada ao cliente.
export default function PatientFields({ clients, name: initialName = '', phone: initialPhone = '' }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const key = phoneKey(phone);
  const matches = key.length >= 10 ? clients.filter((c) => c.phone_key === key) : [];

  function changePhone(value) {
    setPhone(value);
    const newKey = phoneKey(value);
    const found = clients.filter((c) => c.phone_key === newKey);
    if (found.length === 1 && !name.trim()) setName(found[0].name);
  }

  function changeName(value) {
    setName(value);
    const found = clients.find((c) => c.name === value);
    if (found && !phone.trim()) setPhone(found.phone);
  }

  const picked = matches.find((c) => c.name === name);

  return (
    <>
      <label className="span-2">
        Paciente
        <input name="patient_name" list="clients" autoComplete="off" value={name} onChange={(e) => changeName(e.target.value)} required />
        <datalist id="clients">
          {clients.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>
      <label>
        Telefone (WhatsApp)
        <input name="phone" inputMode="tel" placeholder="5511999999999" value={phone} onChange={(e) => changePhone(e.target.value)} />
        {picked ? (
          <span className="hint">Cliente: <Link href={`/clientes/${picked.id}`}>{picked.name}</Link></span>
        ) : matches.length > 0 ? (
          <span className="hint client-matches">
            Deste telefone:
            {matches.map((c) => (
              <button key={c.id} type="button" className="link" onClick={() => setName(c.name)}>{c.name}</button>
            ))}
          </span>
        ) : (
          phone.trim() && name.trim() && <span className="hint">Será cadastrado como novo cliente.</span>
        )}
      </label>
    </>
  );
}
