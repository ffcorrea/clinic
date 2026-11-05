import Link from 'next/link';
import QuoteForm from '../quote-form';
import { requireSession } from '../../../../lib/auth';
import { clientOptions } from '../../../../lib/clients';
import { getClinic, serviceList } from '../../../../lib/clinics';
import { currentClinicId } from '../../../../lib/current';
import { today } from '../../../../lib/time';

// /atendimentos/novo?cliente=<id>
export default async function NewQuotePage({ searchParams }) {
  const user = await requireSession();
  const clinicId = await currentClinicId(user);
  const clinic = clinicId && (await getClinic(clinicId));
  if (!clinic) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;
  const { cliente } = await searchParams;

  return (
    <main>
      <header className="top">
        <h1>Novo atendimento</h1>
        <Link href="/atendimentos">← Voltar para atendimentos</Link>
      </header>
      <QuoteForm clients={await clientOptions(clinicId)} services={serviceList(clinic.settings).map((s) => s.name)} initialClient={cliente} today={today()} />
    </main>
  );
}
