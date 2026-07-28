import { createHmac } from 'node:crypto';
import { secretMatches } from './notifications';

/**
 * Sesión de superadmin sin base de datos: es para 2-3 personas de Ámbar Rojo,
 * no para negocios. La cookie es "expira.firma", firmada con HMAC usando
 * SUPERADMIN_PASS como llave — verificar es puro cómputo, sin tabla ni query.
 * Bonus: rotar SUPERADMIN_PASS invalida todas las sesiones viejas solo.
 *
 * Se cambió de Basic Auth nativo del navegador a esto porque el 401/challenge
 * de Basic Auth se rompía detrás de Cloudflare en más de un navegador — un
 * formulario normal no depende de ese mecanismo.
 */
export const COOKIE_NAME = 'superadmin_session';
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

export function checkCredentials(user: string, pass: string): boolean {
  const expectedUser = process.env.SUPERADMIN_USER;
  const expectedPass = process.env.SUPERADMIN_PASS;
  if (!expectedUser || !expectedPass) return false;
  return secretMatches(user, expectedUser) && secretMatches(pass, expectedPass);
}

export function makeSessionCookieValue(): string {
  const secret = process.env.SUPERADMIN_PASS!;
  const payload = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${payload}.${sign(payload, secret)}`;
}

export function isValidSessionCookie(value: string | undefined): boolean {
  const secret = process.env.SUPERADMIN_PASS;
  if (!value || !secret) return false;

  const [payload, sig] = value.split('.');
  if (!payload || !sig) return false;
  if (!secretMatches(sig, sign(payload, secret))) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}
