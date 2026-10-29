import { redirect } from 'next/navigation';
import { login } from '../actions';
import { getSession } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }) {
  if (await getSession()) redirect('/agenda');
  const { erro } = await searchParams;

  return (
    <main className="login">
      <form action={login} className="card login-card">
        <h1>Entrar</h1>
        <p className="muted">Painel da clínica: agenda e atendimento do WhatsApp</p>
        {erro && <div className="alert error">{erro}</div>}
        <label>
          Usuário
          <input name="email" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus />
        </label>
        <label>
          Senha
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
