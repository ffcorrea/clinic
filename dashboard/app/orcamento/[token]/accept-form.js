'use client';

import { useState, useTransition } from 'react';
import { acceptQuoteAction } from '../../actions';

// O que o navegador informa sem pedir permissao (nenhum aviso aparece)
function browserData() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}`,
    platform: navigator.userAgentData?.platform || navigator.platform,
    languages: navigator.languages?.join(', '),
  };
}

export default function AcceptForm({ token, sendId, label }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptQuoteAction(token, sendId, browserData());
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="accept">
      <label className="accept-check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        Li e concordo com os tratamentos e valores descritos neste orçamento.
      </label>
      <button type="button" onClick={accept} disabled={!agreed || pending}>{pending ? 'Registrando aceite…' : label}</button>
      {error && <div className="alert error">{error}</div>}
    </div>
  );
}
