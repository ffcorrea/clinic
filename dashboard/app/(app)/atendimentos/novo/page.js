import Link from 'next/link';
import QuoteForm from '../quote-form';
import { getAppointment } from '../../../../lib/appointments';
import { requireSession } from '../../../../lib/auth';
import { clientOptions, findClient } from '../../../../lib/clients';
import { getClinic, serviceList } from '../../../../lib/clinics';
import { currentClinicId } from '../../../../lib/current';
import { today } from '../../../../lib/time';

// Dados da consulta que ja entram no atendimento. Observacoes da agenda ficam de fora: tudo no atendimento aparece para o cliente.
async function fromAppointment(clinicId, id) {
  const appointment = Number.isInteger(Number(id)) && (await getAppointment(clinicId, Number(id)));
  if (!appointment || appointment.source === 'block') return {};
  const client = appointment.client_id ? { id: appointment.client_id } : await findClient(clinicId, { phone: appointment.phone, name: appointment.patient_name });
  return { client: client?.id, date: appointment.date, service: appointment.service };
}

// /atendimentos/novo?cliente=<id> ou ?agendamento=<id>
export default async function NewQuotePage({ searchParams }) {
  const user = await requireSession();
  const clinicId = await currentClinicId(user);
  const clinic = clinicId && (await getClinic(clinicId));
  if (!clinic) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;
  const { cliente, agendamento } = await searchParams;
  const initial = await fromAppointment(clinicId, agendamento);

  return (
    <main>
      <header className="top">
        <h1>Novo atendimento</h1>
        <Link href="/atendimentos">← Voltar para atendimentos</Link>
      </header>
      <QuoteForm clients={await clientOptions(clinicId)} services={serviceList(clinic.settings).map((s) => s.name)} initialClient={initial.client ?? cliente} initialDate={initial.date} initialService={initial.service} today={today()} />
    </main>
  );
}
