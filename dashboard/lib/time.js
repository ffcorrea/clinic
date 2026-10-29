// Datas no horario da clinica (Brasilia). O banco guarda UTC. (Mesmo calculo de src/lib/time.js do bot.)
export const TZ = 'America/Sao_Paulo';
export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function toLocal(date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map(({ type, value }) => [type, value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: WEEKDAY_INDEX[p.weekday] };
}

export function fromLocal(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const local = toLocal(guess);
  const offsetMs = new Date(`${local.date}T${local.time}:00Z`) - guess;
  return new Date(guess.getTime() - offsetMs);
}

export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function today() {
  return toLocal(new Date()).date;
}

// Segunda-feira da semana de uma data
export function mondayOf(date) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// "31/10"
export function shortDate(date) {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}
