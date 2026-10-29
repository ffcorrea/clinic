import Link from 'next/link';
import { logout, selectClinic } from '../actions';
import { requireSession } from '../../lib/auth';
import { listClinics } from '../../lib/clinics';
import { currentClinicId } from '../../lib/current';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  const user = await requireSession();
  const isAdmin = user.role === 'admin';
  const clinics = await listClinics();
  const clinicId = await currentClinicId(user);
  const clinicName = clinics.find((c) => c.id === clinicId)?.name;

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <strong className="brand">{isAdmin ? 'Painel' : clinicName}</strong>
          <nav>
            <Link href="/agenda">Agenda</Link>
            <Link href="/configuracao">Configuração</Link>
            {isAdmin && <Link href="/uso">Uso e custos</Link>}
            {isAdmin && <Link href="/usuarios">Usuários</Link>}
          </nav>
          <div className="nav-right">
            {isAdmin && clinics.length > 0 && (
              <form action={selectClinic} className="clinic-select">
                <select name="clinic" defaultValue={clinicId} aria-label="Clínica">
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button type="submit" className="secondary">Trocar</button>
              </form>
            )}
            <form action={logout}>
              <button type="submit" className="link" title={user.email}>Sair</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
