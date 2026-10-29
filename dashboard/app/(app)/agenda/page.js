import Link from 'next/link';
import { changeStatus } from '../../actions';
import Flash from '../../flash';
import AppointmentForm from './form';
import { requireSession } from '../../../lib/auth';
import { listAppointments, STATUSES } from '../../../lib/appointments';
import { getClinic } from '../../../lib/clinics';
import { currentClinicId } from '../../../lib/current';
import { addDays, isIsoDate, mondayOf, shortDate, today, WEEKDAYS } from '../../../lib/time';

const SOURCE_LABEL = { agent: 'Bot', manual: 'Manual' };

function StatusButtons({ appointment, back }) {
  if (appointment.status !== 'scheduled') return null;
  return (
    <div className="row-actions">
      {[
        ['done', 'Compareceu'],
        ['no_show', 'Faltou'],
        ['cancelled', 'Cancelar'],
      ].map(([status, label]) => (
        <form key={status} action={changeStatus}>
          <input type="hidden" name="id" value={appointment.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="back" value={back} />
          <button type="submit" className={status === 'cancelled' ? 'secondary danger' : 'secondary'}>{label}</button>
        </form>
      ))}
    </div>
  );
}

export default async function AgendaPage({ searchParams }) {
  const user = await requireSession();
  const params = await searchParams;
  const clinicId = await currentClinicId(user);
  const clinic = clinicId && (await getClinic(clinicId));
  if (!clinic) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;

  const schedule = clinic.settings.schedule || {};
  const monday = mondayOf(isIsoDate(params.semana) ? params.semana : today());
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const appointments = await listAppointments(clinicId, days[0], days[6]);
  const back = `/agenda?semana=${monday}`;
  const scheduledCount = appointments.filter((a) => a.status === 'scheduled').length;

  return (
    <main>
      <header className="top">
        <div>
          <h1>Agenda</h1>
          <p className="muted">
            Semana de {shortDate(days[0])} a {shortDate(days[6])} · {scheduledCount} agendada{scheduledCount === 1 ? '' : 's'}
          </p>
        </div>
        <nav className="segmented" aria-label="Semana">
          <Link href={`/agenda?semana=${addDays(monday, -7)}`}>← Anterior</Link>
          <Link href="/agenda">Hoje</Link>
          <Link href={`/agenda?semana=${addDays(monday, 7)}`}>Próxima →</Link>
        </nav>
      </header>

      <Flash params={params} />

      <details className="card" open={Boolean(params.erro)}>
        <summary>Novo agendamento</summary>
        <AppointmentForm
          defaults={{ date: today() < days[0] ? days[0] : today(), start: '09:00', duration: schedule.slotMinutes || 60 }}
          services={clinic.settings.services || []}
          back={back}
          submitLabel="Agendar"
        />
      </details>

      {days.map((date) => {
        const list = appointments.filter((a) => a.date === date);
        const hours = schedule.blockedDates?.includes(date) ? 'Bloqueado' : (schedule.week?.[new Date(`${date}T12:00:00Z`).getUTCDay()] || []).join(', ') || 'Fechado';
        return (
          <section key={date} className={`card day${date === today() ? ' today' : ''}`}>
            <h2>
              {WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}, {shortDate(date)}
              <span className="muted day-hours">{hours}</span>
            </h2>
            {list.length === 0 ? (
              <p className="muted">Sem consultas.</p>
            ) : (
              <ul className="appointments">
                {list.map((a) => (
                  <li key={a.id} className={`appointment status-${a.status}`}>
                    <div className="when">{a.start}–{a.end}</div>
                    <div className="who">
                      <strong>{a.patient_name}</strong>
                      {a.service && <span> · {a.service}</span>}
                      <div className="muted small">
                        {a.phone && (
                          <a href={`https://wa.me/${a.phone}`} target="_blank" rel="noreferrer">{a.phone}</a>
                        )}
                        {a.notes && <span className="notes"> · {a.notes}</span>}
                      </div>
                    </div>
                    <div className="tags">
                      <span className={`tag source-${a.source}`}>{SOURCE_LABEL[a.source] || a.source}</span>
                      <span className={`tag st-${a.status}`}>{STATUSES[a.status]}</span>
                    </div>
                    <div className="actions">
                      <StatusButtons appointment={a} back={back} />
                      <Link href={`/agenda/${a.id}`} className="small">Editar</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
