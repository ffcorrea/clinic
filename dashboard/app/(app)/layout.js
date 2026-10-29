import Link from 'next/link';
import NavLinks from './nav-links';
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
          <NavLinks isAdmin={isAdmin} />
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
            <Link href="/conta" className="account-link" title={user.email}>{user.name}</Link>
            <form action={logout}>
              <button type="submit" className="link">Sair</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
