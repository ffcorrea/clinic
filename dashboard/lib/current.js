import { cookies } from 'next/headers';
import { listClinics } from './clinics';

/**
 * Clinica em uso no painel. Usuario de clinica: sempre a dele.
 * Admin: a escolhida no seletor (cookie), ou a primeira.
 */
export async function currentClinicId(user) {
  if (user.role !== 'admin') return user.clinicId;
  const clinics = await listClinics();
  const chosen = (await cookies()).get('clinic')?.value;
  return clinics.some((c) => c.id === chosen) ? chosen : clinics[0]?.id || null;
}
