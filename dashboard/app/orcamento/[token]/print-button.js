'use client';

export default function PrintButton() {
  return <button type="button" className="secondary" onClick={() => window.print()}>Imprimir ou salvar PDF</button>;
}
