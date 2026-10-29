import { saveConfig } from '../../actions';
import Flash from '../../flash';
import { requireSession } from '../../../lib/auth';
import ServicesEditor from './services-editor';
import { CLINIC_TYPES, getClinic, serviceList } from '../../../lib/clinics';
import { currentClinicId } from '../../../lib/current';
import { WEEKDAYS } from '../../../lib/time';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function ConfigPage({ searchParams }) {
  const user = await requireSession();
  const clinicId = await currentClinicId(user);
  const clinic = clinicId && (await getClinic(clinicId));
  if (!clinic) return <main><div className="card empty">Nenhuma clínica cadastrada ainda.</div></main>;

  const s = clinic.settings;
  const schedule = s.schedule || {};

  return (
    <main>
      <header className="top">
        <div>
          <h1>Configuração</h1>
          <p className="muted">O que o bot sabe sobre a clínica e como ele marca consultas</p>
        </div>
      </header>

      <Flash params={await searchParams} />

      <form action={saveConfig}>
        <section className="card">
          <h2>Clínica</h2>
          <div className="grid-form">
            <label className="span-2">
              Nome da clínica
              <input name="name" defaultValue={clinic.name} required />
            </label>
            <label>
              Tipo
              <select name="type" defaultValue={clinic.type}>
                {CLINIC_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Como o bot chama o profissional
              <input name="professional" defaultValue={s.professional} placeholder="a Dra. Glaucia" required />
              <span className="hint">Usado em frases como “a consulta com a Dra. Glaucia”.</span>
            </label>
            <label>
              Instagram
              <input name="instagram" defaultValue={s.instagram} placeholder="@clinica" required />
            </label>
            <div className="span-3 field">
              <span className="field-label">Tratamentos e serviços</span>
              <ServicesEditor initial={serviceList(s)} />
              <span className="hint">
                Duração em branco = a duração padrão da consulta (seção Agenda). O bot só oferece horários em que o
                tratamento cabe inteiro, e só confirma o que está nesta lista; o resto ele passa para a recepção confirmar.
              </span>
            </div>
            <label className="span-3">
              Observações para o bot (uma por linha, opcional)
              <textarea name="notes" rows="3" defaultValue={(s.notes || []).join('\n')} placeholder="Estacionamento no local." />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Agenda</h2>
          <p className="muted small">
            Horários de atendimento por dia, no formato <code>09:00-12:00, 14:00-18:00</code>. Em branco = fechado.
            O bot só oferece horários dentro desses intervalos.
          </p>
          <div className="week-grid">
            {DAY_ORDER.map((day) => (
              <label key={day}>
                {WEEKDAYS[day]}
                <input name={`week${day}`} defaultValue={(schedule.week?.[day] || []).join(', ')} placeholder="Fechado" />
              </label>
            ))}
          </div>
          <div className="grid-form">
            <label>
              Duração padrão da consulta (min)
              <input type="number" name="slotMinutes" min="10" max="480" step="5" defaultValue={schedule.slotMinutes ?? 60} required />
              <span className="hint">Para tratamentos sem duração própria.</span>
            </label>
            <label>
              Antecedência mínima (horas)
              <input type="number" name="minNoticeHours" min="0" max="720" defaultValue={schedule.minNoticeHours ?? 2} required />
            </label>
            <label>
              Marcar até quantos dias à frente
              <input type="number" name="horizonDays" min="1" max="365" defaultValue={schedule.horizonDays ?? 30} required />
            </label>
            <label className="span-3">
              Dias sem atendimento (um por linha, AAAA-MM-DD)
              <textarea name="blockedDates" rows="3" defaultValue={(schedule.blockedDates || []).join('\n')} placeholder="2026-12-25" />
            </label>
          </div>
        </section>

        <div className="form-footer">
          <button type="submit">Salvar configuração</button>
          <span className="muted small">O bot passa a usar em até 1 minuto, sem precisar de deploy.</span>
        </div>
      </form>
    </main>
  );
}
