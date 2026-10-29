import { createUser, resetPassword, toggleUser } from '../../actions';
import Flash from '../../flash';
import { requireSession } from '../../../lib/auth';
import { listClinics } from '../../../lib/clinics';
import { pool } from '../../../lib/db';

export default async function UsersPage({ searchParams }) {
  const me = await requireSession({ admin: true });
  const clinics = await listClinics();
  const clinicName = Object.fromEntries(clinics.map((c) => [c.id, c.name]));
  const [users] = await pool.query('SELECT id, email, name, role, clinic_id, active FROM users ORDER BY active DESC, name');

  return (
    <main>
      <header className="top">
        <div>
          <h1>Usuários</h1>
          <p className="muted">Administradores veem todas as clínicas e os custos; usuários de clínica, só a agenda e a configuração da própria clínica.</p>
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
            E-mail (login)
            <input name="email" type="email" required />
          </label>
          <label>
            Senha inicial
            <input name="password" type="text" minLength={8} required />
          </label>
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
                <th>E-mail</th>
                <th>Perfil</th>
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
                  <td>{u.role === 'admin' ? 'Administrador' : clinicName[u.clinic_id] || u.clinic_id}</td>
                  <td>{u.active ? 'Ativo' : 'Desativado'}</td>
                  <td>
                    <form action={resetPassword} className="inline-form">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="password" type="text" minLength={8} placeholder="mín. 8 caracteres" required />
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
