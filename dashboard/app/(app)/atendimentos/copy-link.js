'use client';

import { useState } from 'react';

export default function CopyLink({ link }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="copy-link">
      <input readOnly value={link} aria-label="Link do orçamento" onFocus={(e) => e.target.select()} />
      <button type="button" className="secondary" onClick={copy}>{copied ? 'Copiado!' : 'Copiar'}</button>
    </div>
  );
}
