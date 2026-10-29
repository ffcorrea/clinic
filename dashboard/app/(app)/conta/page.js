import { changeOwnPassword } from '../../actions';
import Flash from '../../flash';
import { requireSession } from '../../../lib/auth';
import { getClinic } from '../../../lib/clinics';

export default async function AccountPage({ searchParams }) {
  const user = await requireSession();
  const clinic = user.clinicId && (await getClinic(user.clinicId));

  return (
    <main>
      <header className="top">
        <div>
          <h1>Minha conta</h1>
          <p className="muted">
            {user.name} · {user.email} · {user.role === 'admin' ? 'Administrador geral (todas as clínicas)' : `${user.role === 'clinic_admin' ? 'Admin da clínica' : 'Usuário da clínica'} · ${clinic?.name || user.clinicId}`}
          </p>
        </div>
      </header>

      <Flash params={await searchParams} />

      <section className="card">
        <h2>Alterar senha</h2>
        <form action={changeOwnPassword} className="grid-form">
          <label>
            Senha atual
            <input name="current" type="password" autoComplete="current-password" required />
          </label>
          <label>
            Nova senha
            <input name="password" type="password" autoComplete="new-password" required />
          </label>
          <label>
            Repita a nova senha
            <input name="confirm" type="password" autoComplete="new-password" required />
          </label>
          <div className="span-3">
            <button type="submit">Alterar senha</button>
          </div>
        </form>
      </section>
    </main>
  );
}
