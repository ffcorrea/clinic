import { saveBlock } from '../../actions';

// Bloqueio de agenda: periodo em um ou mais dias, ou dias inteiros
export default function BlockForm({ date, back }) {
  return (
    <form action={saveBlock} className="grid-form">
      <input type="hidden" name="back" value={back} />
      <label>
        De (data)
        <input type="date" name="from" defaultValue={date} required />
      </label>
      <label>
        Até (data)
        <input type="date" name="to" defaultValue={date} />
        <span className="hint">Igual à primeira para um dia só.</span>
      </label>
      <label>
        Motivo
        <input name="reason" placeholder="Almoço, compromisso, Dra. ausente…" />
      </label>
      <label>
        Das
        <input type="time" name="start" defaultValue="12:00" step="300" />
      </label>
      <label>
        Até
        <input type="time" name="end" defaultValue="13:00" step="300" />
      </label>
      <label className="check">
        <input type="checkbox" name="allDay" />
        Dia inteiro (sem atendimento)
      </label>
      <div className="span-3">
        <button type="submit">Bloquear</button>
        <span className="muted small"> O bot não oferece horários bloqueados. Almoço de todo dia é melhor no expediente da Configuração (ex: 09:00-12:00, 13:00-18:00).</span>
      </div>
    </form>
  );
}
