import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool } from './db';
import { readToken, signToken } from './token';

const COOKIE = 'sid';
const SESSION_DAYS = 7;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = (stored || '').split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export async function startSession(userId) {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  (await cookies()).set(COOKIE, signToken({ uid: userId, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(exp),
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * Usuario logado (lido do banco a cada request, para valer desativacao na hora), ou null.
 * { id, email, name, role: 'admin' | 'clinic', clinicId }
 */
export async function getSession() {
  const payload = readToken((await cookies()).get(COOKIE)?.value);
  if (!payload) return null;
  const [[user]] = await pool.query(
    'SELECT id, email, name, role, clinic_id AS clinicId FROM users WHERE id = ? AND active = 1',
    [payload.uid]
  );
  return user || null;
}

export async function requireSession({ admin = false } = {}) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (admin && user.role !== 'admin') redirect('/agenda');
  return user;
}

/**
 * Login. Se ainda nao existe nenhum usuario, o primeiro login com DASHBOARD_USER / DASHBOARD_PASSWORD
 * cria o administrador.
 */
export async function authenticate(email, password) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
  if (total === 0 && process.env.DASHBOARD_PASSWORD && email === (process.env.DASHBOARD_USER || 'admin') && password === process.env.DASHBOARD_PASSWORD) {
    const [result] = await pool.query(
      "INSERT INTO users (email, name, password_hash, role) VALUES (?, 'Administrador', ?, 'admin')",
      [email, hashPassword(password)]
    );
    return result.insertId;
  }

  const [[user]] = await pool.query('SELECT id, password_hash FROM users WHERE email = ? AND active = 1', [email]);
  return user && verifyPassword(password, user.password_hash) ? user.id : null;
}
