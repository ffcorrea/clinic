import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectWebhookAction, saveWhatsappAction, selectClinic, toggleClinicAction } from '../../../actions';
import Flash from '../../../flash';
import { requireSession } from '../../../../lib/auth';
import { CLINIC_TYPES, getClinic, getCredentials, listClinicsAdmin } from '../../../../lib/clinics';
import { getQrCode, getStatus } from '../../../../lib/zapi';

export default async function ClinicPage({ params, searchParams }) {
  await requireSession({ admin: true });
  const { id } = await params;
  const clinic = await getClinic(id);
  if (!clinic) notFound();
  const info = (await listClinicsAdmin()).find((c) => c.id === id);

  let credentials = null;
  let credentialsError = null;
  try {
    credentials = await getCredentials(id);
  } catch {
    credentialsError = 'Não foi possível ler os tokens salvos (a chave CREDENTIALS_KEY mudou?). Cadastre-os de novo.';
  }
  const status = credentials ? await getStatus(credentials) : null;
  const qrCode = status && !status.connected && !status.error ? await getQrCode(credentials) : null;

  return (
    <main>
      <header className="top">
        <div>
          <h1>{clinic.name}</h1>
          <p className="muted">
            {CLINIC_TYPES.find((t) => t.id === clinic.type)?.label} · {id} · {info?.active ? 'Ativa' : 'Desativada'} · {info?.users} usuário(s)
          </p>
        </div>
        <Link href="/clinicas">← Clínicas</Link>
      </header>

      <Flash params={await searchParams} />

      <section className="card">
        <h2>WhatsApp</h2>
        {credentialsError && <div className="alert error">{credentialsError}</div>}
        {!credentials && !credentialsError && (
          <p className="muted">
            {info?.has_whatsapp ? '' : 'Sem credenciais cadastradas no painel. '}
            Clínicas antigas usam as variáveis de ambiente do servidor; cadastrar aqui passa a valer no lugar delas só para clínicas criadas pelo painel.
          </p>
        )}
        {status && (
          <div className="whatsapp-status">
            <span className={`dot ${status.connected ? 'on' : 'off'}`} />
            <div>
              <strong>{status.connected ? 'Conectado' : 'Desconectado'}</strong>
              <div className="muted small">
                {status.error
                  ? `Erro da Z-API: ${status.error}`
                  : status.connected
                    ? 'O número está conectado na Z-API.'
                    : 'Abra o WhatsApp do número da clínica → Aparelhos conectados → Conectar aparelho, e leia o QR Code.'}
              </div>
            </div>
          </div>
        )}
        {qrCode && <img src={qrCode} alt="QR Code para conectar o WhatsApp" className="qr" />}

        <form action={saveWhatsappAction} className="grid-form">
          <input type="hidden" name="id" value={id} />
          <label>
            ID da instância
            <input name="zapi_instance_id" defaultValue={credentials?.instanceId || ''} autoComplete="off" required />
          </label>
          <label>
            Token
            <input name="zapi_token" type="password" autoComplete="new-password" placeholder={credentials ? '•••••••• (manter)' : ''} />
          </label>
          <label>
            Client-Token
            <input name="zapi_client_token" type="password" autoComplete="new-password" placeholder={credentials ? '•••••••• (manter)' : ''} />
          </label>
          <div className="span-3">
            <button type="submit">Salvar credenciais</button>
            <span className="muted small">Tokens em branco mantêm os atuais.</span>
          </div>
        </form>

        {credentials && (
          <form action={connectWebhookAction} className="webhook-form">
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="secondary">Conectar webhook</button>
            <span className="muted small">Aponta as mensagens recebidas desse número para o bot. Faça uma vez, pelo painel publicado.</span>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Agenda, tratamentos e usuários</h2>
        <div className="row-actions">
          <form action={selectClinic}>
            <input type="hidden" name="clinic" value={id} />
            <input type="hidden" name="back" value="/configuracao" />
            <button type="submit" className="secondary">Abrir configuração</button>
          </form>
          <form action={selectClinic}>
            <input type="hidden" name="clinic" value={id} />
            <input type="hidden" name="back" value="/agenda" />
            <button type="submit" className="secondary">Abrir agenda</button>
          </form>
          <Link href="/usuarios" className="small">Criar usuário da clínica →</Link>
        </div>
      </section>

      <section className="card">
        <h2>{info?.active ? 'Desativar clínica' : 'Ativar clínica'}</h2>
        <p className="muted small">
          {info?.active
            ? 'O bot para de responder esse número. Agenda, configuração e usuários continuam guardados.'
            : 'O bot volta a responder esse número.'}
        </p>
        <form action={toggleClinicAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={info?.active ? '0' : '1'} />
          <button type="submit" className={info?.active ? 'secondary danger' : 'secondary'}>{info?.active ? 'Desativar' : 'Ativar'}</button>
        </form>
      </section>
    </main>
  );
}
