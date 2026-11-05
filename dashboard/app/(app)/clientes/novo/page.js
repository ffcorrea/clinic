import Link from 'next/link';
import ClientForm from '../client-form';
import { requireSession } from '../../../../lib/auth';

// /clientes/novo?telefone=...&nome=... (vindo de um recado)
export default async function NewClientPage({ searchParams }) {
  await requireSession();
  const { telefone, nome } = await searchParams;
  return (
    <main>
      <header className="top">
        <h1>Novo cliente</h1>
        <Link href="/clientes">← Voltar para clientes</Link>
      </header>
      <section className="card">
        <ClientForm defaults={{ phone: telefone, name: nome }} />
      </section>
    </main>
  );
}
