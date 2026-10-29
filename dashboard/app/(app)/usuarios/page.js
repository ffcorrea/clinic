import { changeRole, createUser, resetPassword, toggleUser } from '../../actions';
import Flash from '../../flash';
import { requireSession } from '../../../lib/auth';
import { listClinics } from '../../../lib/clinics';
import { pool } from '../../../lib/db';

const ROLE_LABEL = { admin: 'Administrador geral', clinic_admin: 'Admin da clínica', clinic: 'Usuário da clínica' };

// Administrador geral: todos os usuarios. Admin da clinica: gerencia os da propria clinica.
// Usuario da clinica: so ve a lista. (As acoes conferem tudo de novo no servidor.)
export default async function UsersPage({ searchParams }) {
  const me = await requireSession();
  const isAdmin = me.role === 'admin';
  const canManage = isAdmin || me.role === 'clinic_admin';
  const clinics = await listClinics();
  const clinicName = Object.fromEntries(clinics.map((c) => [c.id, c.name]));
  const [users] = isAdmin
    ? await pool.query('SELECT id, email, name, role, clinic_id, active FROM users ORDER BY active DESC, name')
    : await pool.query(
        "SELECT id, email, name, role, clinic_id, active FROM users WHERE role <> 'admin' AND clinic_id = ? ORDER BY active DESC, name",
        [me.clinicId]
      );
  const roleOptions = isAdmin ? ['clinic', 'clinic_admin', 'admin'] : ['clinic', 'clinic_admin'];

  return (
    <main>
      <header className="top">
        <div>
          <h1>Usuários</h1>
          <p className="muted">
            {isAdmin
              ? 'Administrador geral vê todas as clínicas. Admin da clínica gerencia os usuários da própria clínica; usuário da clínica só usa o painel.'
              : canManage
                ? `Quem acessa o painel da ${clinicName[me.clinicId] || 'clínica'}. Como admin da clínica, você cria e gerencia esses usuários.`
                : `Quem acessa o painel da ${clinicName[me.clinicId] || 'clínica'}. Para criar, desativar ou trocar a senha de alguém, fale com o admin da clínica. Sua própria senha você troca em Minha conta.`}
          </p>
        </div>
      </header>

      <Flash params={await searchParams} />

      {canManage && (
        <details className="card">
          <summary>Novo usuário</summary>
          <form action={createUser} className="grid-form">
            <label>
              Nome
              <input name="name" required />
            </label>
            <label>
              Usuário (login)
              <input name="email" required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="recepcao" pattern="[A-Za-z0-9._@\-]{3,60}" />
              <span className="hint">Sem espaços nem acentos. Pode ser um e-mail.</span>
            </label>
            <label>
              Senha inicial
              <input name="password" type="text" required />
            </label>
            <label>
              Perfil
              <select name="role" defaultValue="clinic">
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </label>
            {isAdmin && (
              <label className="span-2">
                Clínica (não vale para administrador geral)
                <select name="clinic">
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="span-3">
              <button type="submit">Criar usuário</button>
            </div>
          </form>
        </details>
      )}

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Perfil</th>
                {isAdmin && <th>Clínica</th>}
                <th>Situação</th>
                {canManage && <th>Nova senha</th>}
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                // Admin da clinica nao mexe em si mesmo (perfil) nem no administrador geral
                const editable = canManage && u.id !== me.id && (isAdmin || u.role !== 'admin');
                return (
                  <tr key={u.id} className={u.active ? '' : 'inactive'}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {editable ? (
                        <form action={changeRole} className="inline-form">
                          <input type="hidden" name="id" value={u.id} />
                          <select name="role" defaultValue={u.role} aria-label="Perfil">
                            {(isAdmin && !u.clinic_id ? ['admin'] : roleOptions).map((r) => (
                              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                            ))}
                          </select>
                          <button type="submit" className="secondary">Mudar</button>
                        </form>
                      ) : (
                        ROLE_LABEL[u.role] || u.role
                      )}
                    </td>
                    {isAdmin && <td>{u.clinic_id ? clinicName[u.clinic_id] || u.clinic_id : '—'}</td>}
                    <td>{u.active ? 'Ativo' : 'Desativado'}</td>
                    {canManage && (
                      <td>
                        {editable ? (
                          <form action={resetPassword} className="inline-form">
                            <input type="hidden" name="id" value={u.id} />
                            <input name="password" type="text" placeholder="Nova senha" required />
                            <button type="submit" className="secondary">Alterar</button>
                          </form>
                        ) : u.id === me.id ? (
                          <span className="muted small">Em Minha conta</span>
                        ) : null}
                      </td>
                    )}
                    {canManage && (
                      <td>
                        {editable && (
                          <form action={toggleUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <button type="submit" className="secondary">{u.active ? 'Desativar' : 'Ativar'}</button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
