import Link from 'next/link';
import { importClientsAction } from '../../actions';
import Flash from '../../flash';
import ClientsTable from './clients-table';
import { requireSession } from '../../../lib/auth';
import { listClients } from '../../../lib/clients';
import { currentClinicId } from '../../../lib/current';

export default async function ClientsPage({ searchParams }) {
  const user = await requireSession();
  const clinicId = await currentClinicId(user);
  if (!clinicId) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;
  const clients = await listClients(clinicId);

  return (
    <main>
      <header className="top">
        <div>
          <h1>Clientes</h1>
          <p className="muted">Quem marca pelo bot ou pela agenda entra aqui sozinho, vinculado pelo telefone.</p>
        </div>
        <div className="row-actions">
          <form action={importClientsAction}>
            <button type="submit" className="secondary">Importar da agenda</button>
          </form>
          <Link href="/clientes/novo" className="button">Novo cliente</Link>
        </div>
      </header>
      <Flash params={await searchParams} />
      <ClientsTable clients={clients} />
    </main>
  );
}
