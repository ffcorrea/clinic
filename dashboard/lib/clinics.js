import { pool } from './db';
import { isIsoDate, isTime } from './time';

// Tipos de clinica = modelos de prompt em src/prompts/<tipo>.md (manter em sincronia)
export const CLINIC_TYPES = [
  { id: 'odontologica', label: 'Odontológica' },
  { id: 'medica', label: 'Médica' },
  { id: 'nutricao', label: 'Nutrição' },
];

export async function listClinics() {
  const [rows] = await pool.query('SELECT id, name FROM clinics ORDER BY name');
  return rows;
}

export async function getClinic(id) {
  const [[row]] = await pool.query('SELECT id, name, type, settings, updated_at FROM clinics WHERE id = ?', [id]);
  return row || null;
}

// Tratamentos: "Nome" ou { name, minutes } (minutes vazio = duracao padrao). Mesmo formato do bot.
export function serviceList(settings) {
  return (settings?.services || []).map((s) => (typeof s === 'string' ? { name: s, minutes: null } : s));
}

const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Duracao (min) do procedimento pelo nome; sem correspondencia, a duracao padrao
export function durationFor(settings, serviceName) {
  const wanted = normalize(serviceName);
  const service = wanted && serviceList(settings).find((s) => normalize(s.name) === wanted);
  return service?.minutes || settings?.schedule?.slotMinutes || 60;
}

// Linhas do formulario: "Clareamento dental | 90" (sem "| minutos" = duracao padrao)
export function servicesToText(settings) {
  return serviceList(settings).map((s) => (s.minutes ? `${s.name} | ${s.minutes}` : s.name)).join('\n');
}

const lines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * Le e valida o formulario de configuracao. Retorna { profile } ou { error }.
 * Expediente por dia: "09:00-12:00, 14:00-18:00" (vazio = fechado).
 */
export function parseConfigForm(form) {
  const name = String(form.get('name') || '').trim();
  const type = String(form.get('type') || '');
  const professional = String(form.get('professional') || '').trim();
  const instagram = String(form.get('instagram') || '').trim();
  // Tabela: service_name[] + service_minutes[]; formato antigo: textarea "Nome | minutos"
  const names = form.getAll('service_name');
  const serviceLines = names.length
    ? names
        .map((n, i) => [String(n).trim(), String(form.getAll('service_minutes')[i] ?? '').trim()])
        .filter(([n, m]) => n || m)
        .map(([n, m]) => (m ? `${n} | ${m}` : n))
    : lines(form.get('services'));
  const notes = lines(form.get('notes'));
  const blockedDates = lines(form.get('blockedDates'));
  const slotMinutes = Number(form.get('slotMinutes'));
  const stepMinutes = Number(form.get('stepMinutes'));
  const minNoticeHours = Number(form.get('minNoticeHours'));
  const horizonDays = Number(form.get('horizonDays'));

  if (!name) return { error: 'Informe o nome da clínica.' };
  if (!CLINIC_TYPES.some((t) => t.id === type)) return { error: 'Escolha o tipo da clínica.' };
  if (!professional) return { error: 'Informe como o bot se refere ao profissional (ex: "a Dra. Glaucia").' };
  if (!serviceLines.length) return { error: 'Informe pelo menos um tratamento ou serviço.' };
  const services = [];
  for (const line of serviceLines) {
    const [name, minutesText] = line.split('|').map((part) => part.trim());
    if (!name) return { error: 'Há um tratamento com duração mas sem nome.' };
    if (minutesText === undefined || minutesText === '') {
      services.push({ name, minutes: null });
      continue;
    }
    const minutes = Number(minutesText);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) {
      return { error: `Duração inválida em "${name}": use minutos inteiros entre 5 e 600.` };
    }
    services.push({ name, minutes });
  }
  if (!instagram) return { error: 'Informe o Instagram.' };
  if (!Number.isInteger(slotMinutes) || slotMinutes < 10 || slotMinutes > 480) return { error: 'Duração da consulta deve ser entre 10 e 480 minutos.' };
  if (!Number.isInteger(stepMinutes) || stepMinutes < 5 || stepMinutes > 240) return { error: 'Intervalo entre horários deve ser entre 5 e 240 minutos.' };
  if (!Number.isInteger(minNoticeHours) || minNoticeHours < 0 || minNoticeHours > 720) return { error: 'Antecedência mínima inválida.' };
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 365) return { error: 'Dias à frente deve ser entre 1 e 365.' };
  const badDate = blockedDates.find((d) => !isIsoDate(d));
  if (badDate) return { error: `Data bloqueada inválida: "${badDate}" (use AAAA-MM-DD).` };

  const week = {};
  for (let day = 0; day < 7; day++) {
    const raw = String(form.get(`week${day}`) || '').trim();
    if (!raw) continue;
    const ranges = raw.split(',').map((r) => r.trim().replace(/\s/g, ''));
    for (const range of ranges) {
      const [start, end] = range.split('-');
      if (!isTime(start) || !isTime(end) || start >= end) {
        return { error: `Horário inválido: "${range}". Use o formato 09:00-12:00, separando intervalos por vírgula.` };
      }
    }
    week[day] = ranges;
  }

  return {
    profile: {
      name,
      type,
      settings: {
        professional,
        services,
        instagram,
        notes,
        schedule: { slotMinutes, stepMinutes, minNoticeHours, horizonDays, week, blockedDates },
      },
    },
  };
}

export async function saveClinic(id, { name, type, settings }) {
  await pool.query('UPDATE clinics SET name = ?, type = ?, settings = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [
    name,
    type,
    JSON.stringify(settings),
    id,
  ]);
}
