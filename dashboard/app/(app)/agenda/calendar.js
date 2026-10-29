import Link from 'next/link';
import { unblockDay } from '../../actions';
import { STATUSES } from '../../../lib/appointments';
import { addDays, fromMinutes, mondayOf, shortDate, today, toLocal, toMinutes, weekdayOf, WEEKDAYS } from '../../../lib/time';

const SOURCE_LABEL = { agent: 'Bot', manual: 'Manual' };
const SLOT = 30; // minutos de cada celula clicavel na semana

// Expediente do dia: [] se fechado ou bloqueado
export function openRanges(schedule, date) {
  if (schedule.blockedDates?.includes(date)) return [];
  return (schedule.week?.[weekdayOf(date)] || []).map((r) => r.split('-').map(toMinutes));
}

function tooltip(a) {
  if (a.source === 'block') return `${a.start}–${a.end} Bloqueado: ${a.patient_name}`;
  return [`${a.start}–${a.end} ${a.patient_name}`, a.service, a.phone, `${STATUSES[a.status]} · ${SOURCE_LABEL[a.source] || a.source}`, a.notes]
    .filter(Boolean)
    .join('\n');
}

// Consultas que se sobrepoem ficam lado a lado: lane = coluna, lanes = colunas do grupo
function layout(list) {
  const placed = [];
  let group = [];
  let groupEnd = -1;
  const closeGroup = () => {
    const lanes = Math.max(...group.map((p) => p.lane)) + 1;
    group.forEach((p) => (p.lanes = lanes));
    group = [];
  };
  for (const a of list) {
    const start = toMinutes(a.start);
    const end = Math.max(a.end > a.start ? toMinutes(a.end) : 24 * 60, start + 10);
    if (group.length && start >= groupEnd) closeGroup();
    const busy = group.filter((p) => p.end > start).map((p) => p.lane);
    let lane = 0;
    while (busy.includes(lane)) lane++;
    const item = { a, start, end, lane };
    group.push(item);
    placed.push(item);
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) closeGroup();
  return placed;
}

// Faixa de horas mostrada: cobre o expediente e as consultas da semana (padrao 08-18)
function hourRange(schedule, days, appointments) {
  const marks = days.flatMap((d) => openRanges(schedule, d).flat());
  appointments.forEach((a) => marks.push(toMinutes(a.start), a.end > a.start ? toMinutes(a.end) : 24 * 60));
  if (!marks.length) return [8 * 60, 18 * 60];
  return [Math.floor(Math.min(...marks) / 60) * 60, Math.ceil(Math.max(...marks) / 60) * 60];
}

// Botao "Desbloquear" de um dia inteiro bloqueado (clicar na data)
function UnblockButton({ date, back, className, children }) {
  return (
    <form action={unblockDay} className={className}>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" className="unblock" title={`Desbloquear ${shortDate(date)}`}>
        {children}
      </button>
    </form>
  );
}

export function WeekView({ days, appointments, schedule, href }) {
  const [from, to] = hourRange(schedule, days, appointments);
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60);
  const now = toLocal(new Date());
  const nowMinutes = toMinutes(now.time);

  return (
    <div className="cal-scroll">
      <div className="week" style={{ '--rows': (to - from) / SLOT }}>
        <div className="week-head">
          <div />
          {days.map((date) =>
            schedule.blockedDates?.includes(date) ? (
              <UnblockButton key={date} date={date} back={href()} className={`week-day-name blocked${date === now.date ? ' today' : ''}`}>
                <span>{WEEKDAYS[weekdayOf(date)].slice(0, 3)}</span>
                <strong>{shortDate(date)}</strong>
                <em>Desbloquear</em>
              </UnblockButton>
            ) : (
              <div key={date} className={`week-day-name${date === now.date ? ' today' : ''}`}>
                <span>{WEEKDAYS[weekdayOf(date)].slice(0, 3)}</span>
                <strong>{shortDate(date)}</strong>
              </div>
            )
          )}
        </div>
        <div className="week-body">
          <div className="hours">
            {hours.map((h) => (
              <div key={h} className="hour-label">{fromMinutes(h)}</div>
            ))}
          </div>
          {days.map((date) => {
            const open = openRanges(schedule, date);
            const blocked = schedule.blockedDates?.includes(date);
            const list = appointments.filter((a) => a.date === date);
            return (
              <div key={date} className={`week-col${blocked ? ' blocked' : ''}`}>
                {open.map(([s, e]) => (
                  <div key={s} className="open-hours" style={{ '--start': Math.max(s, from) - from, '--len': Math.min(e, to) - Math.max(s, from) }} />
                ))}
                {Array.from({ length: (to - from) / SLOT }, (_, i) => {
                  const time = fromMinutes(from + i * SLOT);
                  return (
                    <Link
                      key={time}
                      href={href({ novo: date, hora: time }) + '#novo'}
                      className={`slot${(from + i * SLOT) % 60 === 0 ? ' hour' : ''}`}
                      title={`Agendar ${shortDate(date)} às ${time}`}
                      aria-label={`Agendar ${shortDate(date)} às ${time}`}
                    />
                  );
                })}
                {blocked && <div className="blocked-label">Bloqueado</div>}
                {layout(list).map(({ a, start, end, lane, lanes }) => (
                  <Link
                    key={a.id}
                    href={`/agenda/${a.id}`}
                    className={`event status-${a.status} source-${a.source}${end - start < 40 ? ' short' : ''}`}
                    style={{ '--start': Math.max(start, from) - from, '--len': Math.min(end, to) - Math.max(start, from), '--lane': lane, '--lanes': lanes }}
                    title={tooltip(a)}
                  >
                    <span className="event-time">{a.start}</span>
                    <span className="event-name">{a.source === 'block' ? `🔒 ${a.patient_name}` : a.patient_name}</span>
                    {a.service && <span className="event-service">{a.service}</span>}
                  </Link>
                ))}
                {date === now.date && nowMinutes >= from && nowMinutes <= to && <div className="now-line" style={{ '--start': nowMinutes - from }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MONTH_PREVIEW = 3;

export function MonthView({ month, appointments, schedule, href }) {
  const first = mondayOf(month);
  const weeks = [];
  for (let start = first; weeks.length === 0 || start.slice(0, 7) <= month.slice(0, 7); start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  const todayDate = today();

  return (
    <div className="cal-scroll">
      <div className="month">
        {weeks[0].map((date) => (
          <div key={date} className="month-weekday">{WEEKDAYS[weekdayOf(date)].slice(0, 3)}</div>
        ))}
        {weeks.flat().map((date) => {
          const list = appointments.filter((a) => a.date === date);
          const active = list.filter((a) => a.status !== 'cancelled');
          const closed = openRanges(schedule, date).length === 0;
          const classes = ['month-day'];
          if (date.slice(0, 7) !== month.slice(0, 7)) classes.push('other-month');
          if (closed) classes.push('closed');
          if (date === todayDate) classes.push('today');
          // Dia inteiro bloqueado: clicar desbloqueia
          if (schedule.blockedDates?.includes(date)) {
            return (
              <UnblockButton key={date} date={date} back={href()} className={`${classes.join(' ')} blocked`}>
                <span className="month-day-number">{Number(date.slice(8))}</span>
                <span className="month-note">Bloqueado</span>
                <em>Desbloquear</em>
              </UnblockButton>
            );
          }
          return (
            <Link key={date} href={href({ ver: 'semana', data: date })} className={classes.join(' ')} title="Ver a semana">
              <span className="month-day-number">{Number(date.slice(8))}</span>
              {active.slice(0, MONTH_PREVIEW).map((a) => (
                <span key={a.id} className={`chip status-${a.status} source-${a.source}`} title={tooltip(a)}>
                  {a.start} {a.patient_name}
                </span>
              ))}
              {active.length > MONTH_PREVIEW && <span className="month-note">+{active.length - MONTH_PREVIEW} mais</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
