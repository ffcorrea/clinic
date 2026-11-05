'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveClientAction } from '../../actions';
import { formatPhone, maskCep, maskCpf, onlyDigits } from '../../../lib/format';

// Campos controlados: o React limpa formularios nao controlados depois da action, e um erro de validacao
// apagaria o que foi digitado
export default function ClientForm({ client, defaults = {} }) {
  const [state, action, pending] = useActionState(saveClientAction, { error: null });
  const [name, setName] = useState(client?.name ?? defaults.name ?? '');
  const [phone, setPhone] = useState(formatPhone(client?.phone ?? defaults.phone ?? ''));
  const [cpf, setCpf] = useState(maskCpf(client?.cpf ?? ''));
  const [birthDate, setBirthDate] = useState(client?.birth_date ?? '');
  const [cep, setCep] = useState(client?.cep ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [searching, setSearching] = useState(false);

  async function fillAddress(value) {
    const digits = onlyDigits(value);
    if (digits.length !== 8 || address.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) setAddress([data.logradouro, data.bairro, `${data.localidade}/${data.uf}`].filter(Boolean).join(', '));
    } catch {
      // Sem conexao com o ViaCEP: o endereco continua sendo digitado a mao
    } finally {
      setSearching(false);
    }
  }

  return (
    <form action={action} className="grid-form">
      {client && <input type="hidden" name="id" value={client.id} />}
      <label className="span-2">
        Nome
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label>
        Telefone (WhatsApp)
        <input name="phone" inputMode="tel" placeholder="(11) 91234-5678" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} required />
        <span className="hint">Vincula agenda, recados e o bot a este cliente</span>
      </label>
      <label>
        CPF
        <input name="cpf" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
      </label>
      <label>
        Nascimento
        <input type="date" name="birth_date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </label>
      <label>
        CEP {searching && <span className="hint">buscando…</span>}
        <input
          name="cep"
          inputMode="numeric"
          placeholder="00000-000"
          value={cep}
          onChange={(e) => {
            const value = maskCep(e.target.value);
            setCep(value);
            fillAddress(value);
          }}
        />
      </label>
      <label className="span-3">
        Endereço
        <input name="address" placeholder="Rua, número, bairro, cidade" value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <label className="span-3">
        Observações
        <textarea name="notes" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {state.error && <div className="alert error span-3">{state.error}</div>}
      <div className="span-3 form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar cliente'}</button>
        <Link href={client ? `/clientes/${client.id}` : '/clientes'}>Cancelar</Link>
      </div>
    </form>
  );
}
