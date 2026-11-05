import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClientForm from '../../client-form';
import { requireSession } from '../../../../../lib/auth';
import { getClient } from '../../../../../lib/clients';
import { currentClinicId } from '../../../../../lib/current';

export default async function EditClientPage({ params }) {
  const user = await requireSession();
  const { id } = await params;
  const clinicId = await currentClinicId(user);
  const client = clinicId && (await getClient(clinicId, Number(id)));
  if (!client) notFound();

  return (
    <main>
      <header className="top">
        <h1>Editar cliente</h1>
        <Link href={`/clientes/${client.id}`}>← Voltar para o cliente</Link>
      </header>
      <section className="card">
        <ClientForm client={client} />
      </section>
    </main>
  );
}
