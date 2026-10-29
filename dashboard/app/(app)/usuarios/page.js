import { createUser, resetPassword, toggleUser } from '../../actions';
import Flash from '../../flash';
import { requireSession } from '../../../lib/auth';
import { listClinics } from '../../../lib/clinics';
import { pool } from '../../../lib/db';

export default async function UsersPage({ searchParams }) {
  const me = await requireSession();
  const isAdmin = me.role === 'admin';
  const clinics = await listClinics();
  const clinicName = Object.fromEntries(clinics.map((c) => [c.id, c.name]));
  // Usuario de clinica: so os usuarios da propria clinica
  const [users] = isAdmin
    ? await pool.query('SELECT id, email, name, role, clinic_id, active FROM users ORDER BY active DESC, name')
    : await pool.query(
        "SELECT id, email, name, role, clinic_id, active FROM users WHERE role = 'clinic' AND clinic_id = ? ORDER BY active DESC, name",
        [me.clinicId]
      );

  return (
    <main>
      <header className="top">
        <div>
          <h1>Usuários</h1>
          <p className="muted">
            {isAdmin
              ? 'Administradores veem todas as clínicas; usuários de clínica, só a própria clínica.'
              : `Quem acessa o painel da ${clinicName[me.clinicId] || 'clínica'}.`}
          </p>
        </div>
      </header>

      <Flash params={await searchParams} />

      <details className="card">
        <summary>Novo usuário</summary>
        <form action={createUser} className="grid-form">
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Usuário (login)
            <input name="email" required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="glaucia" pattern="[A-Za-z0-9._@\-]{3,60}" />
            <span className="hint">Sem espaços nem acentos. Pode ser um e-mail.</span>
          </label>
          <label>
            Senha inicial
            <input name="password" type="text" required />
          </label>
          {isAdmin && (
            <>
              <label>
                Perfil
                <select name="role" defaultValue="clinic">
                  <option value="clinic">Clínica</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <label className="span-2">
                Clínica (para perfil Clínica)
                <select name="clinic">
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div className="span-3">
            <button type="submit">Criar usuário</button>
          </div>
        </form>
      </details>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                {isAdmin && <th>Perfil</th>}
                <th>Situação</th>
                <th>Nova senha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'inactive'}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  {isAdmin && <td>{u.role === 'admin' ? 'Administrador' : clinicName[u.clinic_id] || u.clinic_id}</td>}
                  <td>{u.active ? 'Ativo' : 'Desativado'}</td>
                  <td>
                    <form action={resetPassword} className="inline-form">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="password" type="text" placeholder="Nova senha" required />
                      <button type="submit" className="secondary">Alterar</button>
                    </form>
                  </td>
                  <td>
                    {u.id !== me.id && (
                      <form action={toggleUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="secondary">{u.active ? 'Desativar' : 'Ativar'}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
