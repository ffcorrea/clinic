// Datas no horario da clinica (Brasilia). O banco guarda UTC.
const TZ = 'America/Sao_Paulo';
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Date (UTC) -> { date: 'YYYY-MM-DD', time: 'HH:MM', weekday: 0-6 } no horario local
function toLocal(date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map(({ type, value }) => [type, value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: WEEKDAY_INDEX[p.weekday] };
}

// 'YYYY-MM-DD' + 'HH:MM' no horario local -> Date (UTC)
function fromLocal(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const local = toLocal(guess);
  const offsetMs = new Date(`${local.date}T${local.time}:00Z`) - guess;
  return new Date(guess.getTime() - offsetMs);
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// "31/10 (sábado) às 09:00"
function describe(date) {
  const local = toLocal(date);
  const [, month, day] = local.date.split('-');
  return `${day}/${month} (${WEEKDAYS[local.weekday]}) às ${local.time}`;
}

module.exports = { TZ, WEEKDAYS, toLocal, fromLocal, addDays, weekdayOf, toMinutes, fromMinutes, describe };
