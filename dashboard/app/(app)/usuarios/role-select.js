'use client';

import { useFormStatus } from 'react-dom';

// Lista de perfil que salva sozinha ao escolher (precisa estar dentro do <form action={changeRole}>)
export default function RoleSelect({ value, options, labels }) {
  const { pending } = useFormStatus();
  return (
    <>
      <select
        name="role"
        defaultValue={value}
        aria-label="Perfil"
        disabled={pending}
        onChange={(event) => event.currentTarget.form.requestSubmit()}
      >
        {options.map((r) => (
          <option key={r} value={r}>{labels[r]}</option>
        ))}
      </select>
      {pending && <span className="muted small">Salvando…</span>}
      <noscript>
        <button type="submit" className="secondary">Mudar</button>
      </noscript>
    </>
  );
}
