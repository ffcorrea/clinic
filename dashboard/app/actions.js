'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, endSession, hashPassword, requireSession, startSession, verifyPassword } from '../lib/auth';
import { createAppointment, createBlock, parseAppointmentForm, setStatus, updateAppointment } from '../lib/appointments';
import {
  createClinic,
  getClinic,
  getCredentials,
  listClinics,
  parseConfigForm,
  parseNewClinicForm,
  parseWhatsapp,
  saveClinic,
  saveWhatsapp,
  setClinicActive,
} from '../lib/clinics';
import { setupWebhook } from '../lib/zapi';
import { addDays, isIsoDate, isTime } from '../lib/time';
import { currentClinicId } from '../lib/current';
import { pool } from '../lib/db';

const withMessage = (path, key, message) => `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message)}`;

// ---- Login ----

export async function login(formData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const userId = email && password ? await authenticate(email, password) : null;
  if (!userId) redirect(withMessage('/login', 'erro', 'Usuário ou senha incorretos.'));
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

// Bloqueia um periodo (ex: 14:00-16:00) em um ou mais dias, ou dias inteiros
export async function saveBlock(formData) {
  const clinicId = await clinicOf();
  const back = String(formData.get('back') || '/agenda');
  const fail = (message) => redirect(withMessage(back, 'erro', message));

  const from = String(formData.get('from') || '');
  const to = String(formData.get('to') || '') || from;
  const allDay = formData.get('allDay') === 'on';
  const start = String(formData.get('start') || '');
  const end = String(formData.get('end') || '');
  const reason = String(formData.get('reason') || '').trim() || 'Bloqueado';

  if (!isIsoDate(from) || !isIsoDate(to) || to < from) fail('Informe a data (e a data final, se for mais de um dia).');
  const dates = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  if (dates.length > 62) fail('Bloqueie no máximo 62 dias por vez.');

  if (allDay) {
    const clinic = await getClinic(clinicId);
    const schedule = clinic.settings.schedule || {};
    const blockedDates = [...new Set([...(schedule.blockedDates || []), ...dates])].sort();
    await saveClinic(clinicId, { name: clinic.name, type: clinic.type, settings: { ...clinic.settings, schedule: { ...schedule, blockedDates } } });
    redirect(withMessage(back, 'ok', `${dates.length === 1 ? 'Dia bloqueado' : `${dates.length} dias bloqueados`}. Para desbloquear, use “Dias sem atendimento” na Configuração.`));
  }

  if (!isTime(start) || !isTime(end) || start >= end) fail('Informe o horário de início e de fim do bloqueio.');
  const done = [];
  for (const date of dates) {
    const problem = await createBlock(clinicId, { date, start, end, reason });
    if (problem) fail(`${done.length ? `${done.length} dia(s) bloqueado(s); parou em ${date.split('-').reverse().join('/')}: ` : ''}${problem}`);
    done.push(date);
  }
  redirect(withMessage(back, 'ok', `Horário bloqueado (${start}–${end}${dates.length > 1 ? `, ${dates.length} dias` : ''}).`));
}

// Tira um dia dos "Dias sem atendimento" (desfaz o bloqueio de dia inteiro)
export async function unblockDay(formData) {
  const clinicId = await clinicOf();
  const back = String(formData.get('back') || '/agenda');
  const date = String(formData.get('date') || '');
  const clinic = await getClinic(clinicId);
  const schedule = clinic.settings.schedule || {};
  const blockedDates = (schedule.blockedDates || []).filter((d) => d !== date);
  await saveClinic(clinicId, { name: clinic.name, type: clinic.type, settings: { ...clinic.settings, schedule: { ...schedule, blockedDates } } });
  redirect(withMessage(back, 'ok', `Dia ${date.split('-').reverse().join('/')} desbloqueado. O bot volta a oferecer horários nele em até 1 minuto.`));
}

// ---- Configuracao ----

export async function saveConfig(formData) {
  const clinicId = await clinicOf();
  const { profile, error } = parseConfigForm(formData);
  if (error) redirect(withMessage('/configuracao', 'erro', error));
  await saveClinic(clinicId, profile);
  redirect(withMessage('/configuracao', 'ok', 'Configuração salva. O bot passa a usar em até 1 minuto.'));
}

// ---- Clinicas (so admin) ----

export async function createClinicAction(formData) {
  await requireSession({ admin: true });
  const { clinic, error } = parseNewClinicForm(formData);
  if (error) redirect(withMessage('/clinicas', 'erro', error));
  const problem = await createClinic(clinic);
  if (problem) redirect(withMessage('/clinicas', 'erro', problem));
  redirect(withMessage(`/clinicas/${clinic.id}`, 'ok', `Clínica ${clinic.name} criada. Confira o WhatsApp abaixo e depois a Configuração (expediente e tratamentos).`));
}

export async function saveWhatsappAction(formData) {
  await requireSession({ admin: true });
  const id = String(formData.get('id') || '');
  const back = `/clinicas/${id}`;
  const { credentials, error } = parseWhatsapp(formData, { required: true });
  if (error) redirect(withMessage(back, 'erro', error));
  const problem = await saveWhatsapp(id, credentials);
  if (problem) redirect(withMessage(back, 'erro', problem));
  redirect(withMessage(back, 'ok', 'WhatsApp salvo. O bot passa a usar em até 1 minuto.'));
}

export async function toggleClinicAction(formData) {
  await requireSession({ admin: true });
  const id = String(formData.get('id') || '');
  const active = formData.get('active') === '1';
  await setClinicActive(id, active);
  redirect(withMessage(`/clinicas/${id}`, 'ok', active ? 'Clínica ativada: o bot volta a atender.' : 'Clínica desativada: o bot para de atender esse número.'));
}

// Aponta o webhook da Z-API para este servidor (precisa ser o painel publicado, nao localhost)
export async function connectWebhookAction(formData) {
  await requireSession({ admin: true });
  const id = String(formData.get('id') || '');
  const back = `/clinicas/${id}`;
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(host)) {
    redirect(withMessage(back, 'erro', 'Conecte pelo painel publicado (a Z-API não consegue chamar o localhost).'));
  }
  const credentials = await getCredentials(id);
  if (!credentials) redirect(withMessage(back, 'erro', 'Cadastre as credenciais da Z-API primeiro.'));

  const secret = process.env.WEBHOOK_SECRET;
  const webhookUrl = `${proto}://${host}/zapi/${id}/webhook${secret ? `?token=${encodeURIComponent(secret)}` : ''}`;
  try {
    await setupWebhook(credentials, webhookUrl);
  } catch (error) {
    redirect(withMessage(back, 'erro', `A Z-API recusou: ${error.message}`));
  }
  redirect(withMessage(back, 'ok', 'Webhook configurado: as mensagens desse número agora chegam ao bot.'));
}

// ---- Minha conta (qualquer usuario) ----

export async function changeOwnPassword(formData) {
  const me = await requireSession();
  const current = String(formData.get('current') || '');
  const password = String(formData.get('password') || '');
  const fail = (message) => redirect(withMessage('/conta', 'erro', message));

  const [[row]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [me.id]);
  if (!row || !verifyPassword(current, row.password_hash)) fail('Senha atual incorreta.');
  if (!password) fail('Informe a nova senha.');
  if (password !== String(formData.get('confirm') || '')) fail('As duas senhas novas não são iguais.');

  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), me.id]);
  redirect(withMessage('/conta', 'ok', 'Senha alterada.'));
}

// ---- Usuarios ----
// Perfis: admin (administrador geral, todas as clinicas), clinic_admin (admin da clinica: gerencia os
// usuarios da propria clinica) e clinic (usuario da clinica: so ve a lista). Tudo conferido aqui no servidor.

const ROLES = ['admin', 'clinic_admin', 'clinic'];

async function requireUserManager() {
  const me = await requireSession();
  if (me.role !== 'admin' && me.role !== 'clinic_admin') redirect(withMessage('/usuarios', 'erro', 'Só administradores podem gerenciar usuários.'));
  return me;
}

// Usuario que "me" pode gerenciar (admin da clinica: so da propria clinica, nunca o administrador geral)
async function managedUser(me, id) {
  const [[user]] = await pool.query('SELECT id, role, clinic_id FROM users WHERE id = ?', [id]);
  if (!user) return null;
  if (me.role === 'admin') return user;
  return user.role !== 'admin' && user.clinic_id === me.clinicId ? user : null;
}

// Perfil e clinica pedidos, limitados ao que "me" pode dar. Retorna { role, clinicId } ou { error }.
async function allowedRole(me, formData) {
  const requested = ROLES.includes(formData.get('role')) ? formData.get('role') : 'clinic';
  if (me.role !== 'admin') {
    if (requested === 'admin') return { error: 'Só o administrador geral cria administradores gerais.' };
    return { role: requested, clinicId: me.clinicId };
  }
  if (requested === 'admin') return { role: 'admin', clinicId: null };
  const clinicId = String(formData.get('clinic') || '');
  if (!(await listClinics()).some((c) => c.id === clinicId)) return { error: 'Escolha a clínica do usuário.' };
  return { role: requested, clinicId };
}

export async function createUser(formData) {
  const me = await requireUserManager();
  const name = String(formData.get('name') || '').trim();
  // Login: qualquer nome de usuario (ou e-mail). Fica na coluna "email" da tabela users.
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!name || !email) redirect(withMessage('/usuarios', 'erro', 'Informe nome e usuário.'));
  if (!/^[a-z0-9._@-]{3,60}$/.test(email)) {
    redirect(withMessage('/usuarios', 'erro', 'Usuário inválido: use de 3 a 60 letras, números, ponto, hífen, _ ou @ (sem espaços e acentos).'));
  }
  if (!password) redirect(withMessage('/usuarios', 'erro', 'Informe a senha.'));
  const { role, clinicId, error } = await allowedRole(me, formData);
  if (error) redirect(withMessage('/usuarios', 'erro', error));

  try {
    await pool.query('INSERT INTO users (email, name, password_hash, role, clinic_id) VALUES (?, ?, ?, ?, ?)', [
      email,
      name,
      hashPassword(password),
      role,
      clinicId,
    ]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') redirect(withMessage('/usuarios', 'erro', 'Já existe esse usuário. Escolha outro.'));
    throw error;
  }
  redirect(withMessage('/usuarios', 'ok', `Usuário ${email} criado.`));
}

export async function toggleUser(formData) {
  const me = await requireUserManager();
  const id = Number(formData.get('id'));
  if (id === me.id) redirect(withMessage('/usuarios', 'erro', 'Você não pode desativar o próprio usuário.'));
  if (!(await managedUser(me, id))) redirect(withMessage('/usuarios', 'erro', 'Usuário não encontrado.'));
  await pool.query('UPDATE users SET active = 1 - active WHERE id = ?', [id]);
  redirect('/usuarios');
}

export async function resetPassword(formData) {
  const me = await requireUserManager();
  const id = Number(formData.get('id'));
  const password = String(formData.get('password') || '');
  if (!password) redirect(withMessage('/usuarios', 'erro', 'Informe a senha.'));
  if (!(await managedUser(me, id))) redirect(withMessage('/usuarios', 'erro', 'Usuário não encontrado.'));
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), id]);
  redirect(withMessage('/usuarios', 'ok', 'Senha alterada.'));
}

// Muda o perfil (admin da clinica <-> usuario da clinica; admin geral tambem promove a admin geral)
export async function changeRole(formData) {
  const me = await requireUserManager();
  const id = Number(formData.get('id'));
  if (id === me.id) redirect(withMessage('/usuarios', 'erro', 'Você não pode mudar o próprio perfil.'));
  const target = await managedUser(me, id);
  if (!target) redirect(withMessage('/usuarios', 'erro', 'Usuário não encontrado.'));
  const role = String(formData.get('role') || '');
  if (!ROLES.includes(role)) redirect(withMessage('/usuarios', 'erro', 'Perfil inválido.'));
  if (role === 'admin' && me.role !== 'admin') redirect(withMessage('/usuarios', 'erro', 'Só o administrador geral cria administradores gerais.'));
  if (role !== 'admin' && !target.clinic_id) redirect(withMessage('/usuarios', 'erro', 'Esse usuário não tem clínica; crie um novo usuário para a clínica.'));
  await pool.query('UPDATE users SET role = ?, clinic_id = ? WHERE id = ?', [role, role === 'admin' ? null : target.clinic_id, id]);
  redirect(withMessage('/usuarios', 'ok', 'Perfil alterado.'));
}
