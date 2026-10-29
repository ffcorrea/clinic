'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, endSession, hashPassword, requireSession, startSession } from '../lib/auth';
import { createAppointment, parseAppointmentForm, setStatus, updateAppointment } from '../lib/appointments';
import { getClinic, listClinics, parseConfigForm, saveClinic } from '../lib/clinics';
import { currentClinicId } from '../lib/current';
import { pool } from '../lib/db';

const withMessage = (path, key, message) => `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message)}`;

// ---- Login ----

export async function login(formData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const userId = email && password ? await authenticate(email, password) : null;
  if (!userId) redirect(withMessage('/login', 'erro', 'E-mail ou senha incorretos.'));
  await startSession(userId);
  redirect('/agenda');
}

export async function logout() {
  await endSession();
  redirect('/login');
}

// Admin: escolhe a clinica que esta vendo
export async function selectClinic(formData) {
  const user = await requireSession({ admin: true });
  const clinicId = String(formData.get('clinic') || '');
  if ((await listClinics()).some((c) => c.id === clinicId)) {
    (await cookies()).set('clinic', clinicId, { path: '/', sameSite: 'lax', httpOnly: true });
  }
  redirect(String(formData.get('back') || '/agenda'));
}

// ---- Agenda ----

async function clinicOf() {
  const user = await requireSession();
  const clinicId = await currentClinicId(user);
  if (!clinicId) redirect('/agenda');
  return clinicId;
}

export async function saveAppointment(formData) {
  const clinicId = await clinicOf();
  const id = Number(formData.get('id')) || null;
  const back = String(formData.get('back') || '/agenda');
  const errorPath = id ? `/agenda/${id}` : back;

  const clinic = await getClinic(clinicId);
  const { data, error } = parseAppointmentForm(formData, clinic?.settings);
  if (error) redirect(withMessage(errorPath, 'erro', error));

  const problem = id ? await updateAppointment(clinicId, id, data) : await createAppointment(clinicId, data);
  if (problem) redirect(withMessage(errorPath, 'erro', problem));
  redirect(withMessage(back, 'ok', id ? 'Agendamento atualizado.' : 'Agendamento criado.'));
}

export async function changeStatus(formData) {
  const clinicId = await clinicOf();
  const back = String(formData.get('back') || '/agenda');
  const problem = await setStatus(clinicId, Number(formData.get('id')), String(formData.get('status')));
  redirect(problem ? withMessage(back, 'erro', problem) : back);
}

// ---- Configuracao ----

export async function saveConfig(formData) {
  const clinicId = await clinicOf();
  const { profile, error } = parseConfigForm(formData);
  if (error) redirect(withMessage('/configuracao', 'erro', error));
  await saveClinic(clinicId, profile);
  redirect(withMessage('/configuracao', 'ok', 'Configuração salva. O bot passa a usar em até 1 minuto.'));
}

// ---- Usuarios (so admin) ----

export async function createUser(formData) {
  await requireSession({ admin: true });
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const role = formData.get('role') === 'admin' ? 'admin' : 'clinic';
  const clinicId = role === 'clinic' ? String(formData.get('clinic') || '') : null;

  if (!name || !email) redirect(withMessage('/usuarios', 'erro', 'Informe nome e e-mail.'));
  if (password.length < 8) redirect(withMessage('/usuarios', 'erro', 'A senha precisa ter pelo menos 8 caracteres.'));
  if (role === 'clinic' && !(await listClinics()).some((c) => c.id === clinicId)) {
    redirect(withMessage('/usuarios', 'erro', 'Escolha a clínica do usuário.'));
  }

  try {
    await pool.query('INSERT INTO users (email, name, password_hash, role, clinic_id) VALUES (?, ?, ?, ?, ?)', [
      email,
      name,
      hashPassword(password),
      role,
      clinicId,
    ]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') redirect(withMessage('/usuarios', 'erro', 'Já existe um usuário com esse e-mail.'));
    throw error;
  }
  redirect(withMessage('/usuarios', 'ok', `Usuário ${email} criado.`));
}

export async function toggleUser(formData) {
  const me = await requireSession({ admin: true });
  const id = Number(formData.get('id'));
  if (id === me.id) redirect(withMessage('/usuarios', 'erro', 'Você não pode desativar o próprio usuário.'));
  await pool.query('UPDATE users SET active = 1 - active WHERE id = ?', [id]);
  redirect('/usuarios');
}

export async function resetPassword(formData) {
  await requireSession({ admin: true });
  const password = String(formData.get('password') || '');
  if (password.length < 8) redirect(withMessage('/usuarios', 'erro', 'A senha precisa ter pelo menos 8 caracteres.'));
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), Number(formData.get('id'))]);
  redirect(withMessage('/usuarios', 'ok', 'Senha alterada.'));
}
