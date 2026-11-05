import Link from 'next/link';
import { notFound } from 'next/navigation';
import QuoteForm from '../../quote-form';
import { requireSession } from '../../../../../lib/auth';
import { clientOptions } from '../../../../../lib/clients';
import { getClinic, serviceList } from '../../../../../lib/clinics';
import { currentClinicId } from '../../../../../lib/current';
import { getQuote } from '../../../../../lib/quotes';
import { today } from '../../../../../lib/time';

export default async function EditQuotePage({ params }) {
  const user = await requireSession();
  const { id } = await params;
  const clinicId = await currentClinicId(user);
  const quote = clinicId && (await getQuote(clinicId, Number(id)));
  if (!quote) notFound();
  const clinic = await getClinic(clinicId);

  return (
    <main>
      <header className="top">
        <h1>Editar atendimento #{quote.id}</h1>
        <Link href={`/atendimentos/${quote.id}`}>← Voltar para o atendimento</Link>
      </header>
      <QuoteForm quote={quote} clients={await clientOptions(clinicId)} services={serviceList(clinic.settings).map((s) => s.name)} today={today()} />
    </main>
  );
}
