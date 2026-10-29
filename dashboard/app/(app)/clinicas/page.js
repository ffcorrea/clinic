import Link from 'next/link';
import { createClinicAction } from '../../actions';
import Flash from '../../flash';
import ServicesEditor from '../configuracao/services-editor';
import { requireSession } from '../../../lib/auth';
import { CLINIC_TYPES, listClinicsAdmin } from '../../../lib/clinics';

const TYPE_LABEL = Object.fromEntries(CLINIC_TYPES.map((t) => [t.id, t.label]));

export default async function ClinicsPage({ searchParams }) {
  await requireSession({ admin: true });
  const params = await searchParams;
  const clinics = await listClinicsAdmin();

  return (
    <main>
      <header className="top">
        <div>
          <h1>Clínicas</h1>
          <p className="muted">Cada clínica tem seu número de WhatsApp, sua agenda e seus usuários.</p>
        </div>
      </header>

      <Flash params={params} />

      <details className="card" open={Boolean(params.erro)}>
        <summary>Nova clínica</summary>
        <form action={createClinicAction} className="grid-form">
          <label className="span-2">
            Nome da clínica
            <input name="name" placeholder="Instituto Lirium" required />
          </label>
          <label>
            Tipo
            <select name="type" defaultValue="odontologica">
              {CLINIC_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            Identificador (opcional)
            <input name="id" placeholder="instituto-lirium" pattern="[a-z0-9-]*" />
            <span className="hint">Vai no endereço do webhook. Em branco: gerado pelo nome.</span>
          </label>
          <label>
            Como o bot chama o profissional
            <input name="professional" placeholder="a Dra. Fulana" required />
          </label>
          <label>
            Instagram
            <input name="instagram" placeholder="@clinica" required />
          </label>
          <div className="span-3 field">
            <span className="field-label">Tratamentos e serviços</span>
            <ServicesEditor initial={[]} />
          </div>

          <div className="span-3 section-title">
            <h2>WhatsApp (Z-API)</h2>
            <p className="muted small">Pode deixar em branco e cadastrar depois. Os tokens ficam criptografados no banco.</p>
          </div>
          <label>
            ID da instância
            <input name="zapi_instance_id" autoComplete="off" />
          </label>
          <label>
            Token
            <input name="zapi_token" type="password" autoComplete="new-password" />
          </label>
          <label>
            Client-Token (segurança da conta)
            <input name="zapi_client_token" type="password" autoComplete="new-password" />
          </label>
          <div className="span-3">
            <button type="submit">Criar clínica</button>
            <span className="muted small">Expediente inicial: seg a sex 9h–18h, sáb 9h–12h, consultas de 60 min (ajuste depois na Configuração).</span>
          </div>
        </form>
      </details>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Clínica</th>
                <th>Tipo</th>
                <th>WhatsApp</th>
                <th className="num">Usuários</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'inactive'}>
                  <td>
                    <Link href={`/clinicas/${c.id}`} className="strong">{c.name}</Link>
                    <div className="muted small">{c.id}</div>
                  </td>
                  <td>{TYPE_LABEL[c.type] || c.type}</td>
                  <td>{c.has_whatsapp ? 'Cadastrado' : 'Não cadastrado (bot não atende)'}</td>
                  <td className="num">{c.users}</td>
                  <td>{c.active ? 'Ativa' : 'Desativada'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
