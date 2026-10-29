import { saveAppointment } from '../../actions';

// Formulario de agendamento (novo ou edicao)
export default function AppointmentForm({ appointment, defaults, services, back, submitLabel }) {
  const a = appointment || {};
  return (
    <form action={saveAppointment} className="grid-form">
      {a.id && <input type="hidden" name="id" value={a.id} />}
      <input type="hidden" name="back" value={back} />
      <label>
        Data
        <input type="date" name="date" defaultValue={a.date || defaults.date} required />
      </label>
      <label>
        Horário
        <input type="time" name="start" defaultValue={a.start || defaults.start} step="300" required />
      </label>
      <label>
        Duração (min)
        <input type="number" name="duration" min="5" max="600" step="5" defaultValue={a.duration || defaults.duration} required />
      </label>
      <label className="span-2">
        Paciente
        <input name="patient_name" defaultValue={a.patient_name} required />
      </label>
      <label>
        Telefone (WhatsApp)
        <input name="phone" inputMode="tel" placeholder="5511999999999" defaultValue={a.phone || ''} />
      </label>
      <label className="span-3">
        Tratamento
        <input name="service" list="services" defaultValue={a.service || ''} />
        <datalist id="services">
          {services.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label className="span-3">
        Observações
        <textarea name="notes" rows="2" defaultValue={a.notes || ''} />
      </label>
      <div className="span-3">
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
