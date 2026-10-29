import Link from 'next/link';
import { notFound } from 'next/navigation';
import { changeStatus } from '../../../actions';
import Flash from '../../../flash';
import AppointmentForm from '../form';
import { requireSession } from '../../../../lib/auth';
import { getAppointment, STATUSES } from '../../../../lib/appointments';
import { getClinic, serviceList } from '../../../../lib/clinics';
import { currentClinicId } from '../../../../lib/current';

export default async function EditAppointmentPage({ params, searchParams }) {
  const user = await requireSession();
  const { id } = await params;
  const clinicId = await currentClinicId(user);
  const appointment = clinicId && (await getAppointment(clinicId, Number(id)));
  if (!appointment) notFound();
  const clinic = await getClinic(clinicId);
  const back = `/agenda?data=${appointment.date}`;

  return (
    <main>
      <header className="top">
        <div>
          <h1>Editar agendamento</h1>
          <p className="muted">
            {STATUSES[appointment.status]} · criado {appointment.source === 'agent' ? 'pelo bot' : 'manualmente'}
            {appointment.phone && (
              <>
                {' · '}
                <a href={`https://wa.me/${appointment.phone}`} target="_blank" rel="noreferrer">WhatsApp {appointment.phone}</a>
              </>
            )}
          </p>
        </div>
        <Link href={back}>← Voltar para a agenda</Link>
      </header>
      <Flash params={await searchParams} />
      <section className="card">
        <AppointmentForm appointment={appointment} defaults={{ duration: clinic.settings.schedule?.slotMinutes || 60 }} services={serviceList(clinic.settings).map((s) => s.name)} back={back} submitLabel="Salvar" />
      </section>
      {appointment.status === 'scheduled' ? (
        <section className="card">
          <h2>Status</h2>
          <div className="row-actions">
            {[
              ['done', 'Compareceu'],
              ['no_show', 'Faltou'],
              ['cancelled', 'Cancelar consulta'],
            ].map(([status, label]) => (
              <form key={status} action={changeStatus}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="back" value={back} />
                <button type="submit" className={status === 'cancelled' ? 'secondary danger' : 'secondary'}>{label}</button>
              </form>
            ))}
          </div>
        </section>
      ) : (
        <form action={changeStatus} className="card">
          <input type="hidden" name="id" value={appointment.id} />
          <input type="hidden" name="status" value="scheduled" />
          <input type="hidden" name="back" value={back} />
          <p className="muted">Este agendamento está como “{STATUSES[appointment.status]}”.</p>
          <button type="submit" className="secondary">Voltar para Agendado</button>
        </form>
      )}
    </main>
  );
}
