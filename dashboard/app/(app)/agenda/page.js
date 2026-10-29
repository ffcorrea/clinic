import Link from 'next/link';
import Flash from '../../flash';
import AppointmentForm from './form';
import { MonthView, WeekView } from './calendar';
import { requireSession } from '../../../lib/auth';
import { listAppointments } from '../../../lib/appointments';
import { getClinic, serviceList } from '../../../lib/clinics';
import { currentClinicId } from '../../../lib/current';
import { addDays, addMonths, isIsoDate, isTime, mondayOf, monthLabel, shortDate, startOfMonth, today } from '../../../lib/time';

// /agenda?ver=semana|mes&data=AAAA-MM-DD (aceita tambem o antigo ?semana=)
export default async function AgendaPage({ searchParams }) {
  const user = await requireSession();
  const params = await searchParams;
  const clinicId = await currentClinicId(user);
  const clinic = clinicId && (await getClinic(clinicId));
  if (!clinic) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;

  const schedule = clinic.settings.schedule || {};
  const view = params.ver === 'mes' ? 'mes' : 'semana';
  const date = [params.data, params.semana].find(isIsoDate) || today();
  const showCancelled = params.cancelados === '1';
  const href = (extra = {}) => {
    const query = new URLSearchParams({ ver: view, data: date, ...(showCancelled && { cancelados: '1' }), ...extra });
    return `/agenda?${query}`;
  };
  const back = href();

  let range, title, prev, next;
  if (view === 'mes') {
    const month = startOfMonth(date);
    const first = mondayOf(month);
    const last = addDays(mondayOf(addDays(addMonths(month, 1), -1)), 6);
    range = [first, last];
    title = monthLabel(month);
    prev = addMonths(month, -1);
    next = addMonths(month, 1);
  } else {
    const monday = mondayOf(date);
    range = [monday, addDays(monday, 6)];
    title = `${shortDate(range[0])} a ${shortDate(range[1])}`;
    prev = addDays(monday, -7);
    next = addDays(monday, 7);
  }
  const all = await listAppointments(clinicId, range[0], range[1]);
  const appointments = showCancelled ? all : all.filter((a) => a.status !== 'cancelled');
  const scheduledCount = all.filter((a) => a.status === 'scheduled' && (view === 'semana' || a.date.startsWith(date.slice(0, 7)))).length;

  const newDate = isIsoDate(params.novo) ? params.novo : today() < range[0] ? range[0] : today();
  const newTime = isTime(params.hora) ? params.hora : '09:00';

  return (
    <main className="wide">
      <header className="top">
        <div>
          <h1 className="cal-title">{view === 'mes' ? title : `Semana de ${title}`}</h1>
          <p className="muted">
            {scheduledCount} agendada{scheduledCount === 1 ? '' : 's'}
            {' · '}
            <Link href={href({ cancelados: showCancelled ? '0' : '1' })}>{showCancelled ? 'Ocultar' : 'Mostrar'} cancelados</Link>
          </p>
        </div>
        <div className="cal-controls">
          <nav className="segmented" aria-label="Visualização">
            <Link href={href({ ver: 'semana' })} className={view === 'semana' ? 'active' : ''}>Semana</Link>
            <Link href={href({ ver: 'mes' })} className={view === 'mes' ? 'active' : ''}>Mês</Link>
          </nav>
          <nav className="segmented" aria-label="Período">
            <Link href={href({ data: prev })} aria-label="Anterior">←</Link>
            <Link href={href({ data: today() })}>Hoje</Link>
            <Link href={href({ data: next })} aria-label="Próximo">→</Link>
          </nav>
        </div>
      </header>

      <Flash params={params} />

      <details id="novo" className="card" open={Boolean(params.erro || params.novo)}>
        <summary>Novo agendamento</summary>
        <AppointmentForm
          key={`${newDate}-${newTime}`}
          defaults={{ date: newDate, start: newTime, duration: schedule.slotMinutes || 60 }}
          services={serviceList(clinic.settings).map((s) => s.name)}
          back={back}
          submitLabel="Agendar"
        />
      </details>

      {view === 'mes' ? (
        <MonthView month={startOfMonth(date)} appointments={appointments} schedule={schedule} href={href} />
      ) : (
        <WeekView days={Array.from({ length: 7 }, (_, i) => addDays(range[0], i))} appointments={appointments} schedule={schedule} href={href} />
      )}

      <p className="muted small cal-legend">
        <span className="legend status-scheduled">Agendado</span>
        <span className="legend status-done">Compareceu</span>
        <span className="legend status-no_show">Faltou</span>
        {showCancelled && <span className="legend status-cancelled">Cancelado</span>}
        <span>{view === 'semana' ? 'Clique num horário vazio para agendar, ou numa consulta para editar.' : 'Clique num dia para ver a semana.'}</span>
      </p>
    </main>
  );
}
