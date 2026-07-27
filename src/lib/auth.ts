import { cookies } from 'next/headers';
import { sql } from './db';
import type { PanelBusiness } from './panel';

const COOKIE = 'sesion';
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 15;

/** Cuántos links de acceso puede pedir alguien por ventana. Cada uno cuesta. */
const MAX_REQUESTS = 3;
const WINDOW_MINUTES = 15;

export type SessionUser = {
  user_id: string;
  role: string;
  business: PanelBusiness;
};

/**
 * Crea un link de acceso de un solo uso. Devuelve null si el teléfono no
 * pertenece a nadie o si ya pidió demasiados: en ambos casos la pantalla
 * responde lo mismo, para no revelar qué teléfonos están dados de alta.
 */
export async function createLoginToken(phoneE164: string): Promise<
  { token: string; name: string; phone: string } | null
> {
  const users = (await sql`
    select u.id, b.name from users u
      join businesses b on b.id = u.business_id
     where u.phone = ${phoneE164}
  `) as { id: string; name: string }[];
  const user = users[0];
  if (!user) return null;

  const recent = (await sql`
    select count(*)::int as n from login_tokens
     where user_id = ${user.id}
       and created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
  `) as { n: number }[];
  if ((recent[0]?.n ?? 0) >= MAX_REQUESTS) return null;

  const rows = (await sql`
    insert into login_tokens (user_id, expires_at)
    values (${user.id}, now() + make_interval(mins => ${TOKEN_MINUTES}))
    returning token
  `) as { token: string }[];

  return { token: rows[0].token, name: user.name, phone: phoneE164 };
}

/**
 * Canjea el token por una sesión. Un solo uso: el `used_at is null` dentro del
 * UPDATE hace que dos peticiones simultáneas solo puedan ganar una.
 */
export async function consumeLoginToken(token: string): Promise<boolean> {
  const claimed = (await sql`
    update login_tokens set used_at = now()
     where token = ${token} and used_at is null and expires_at > now()
    returning user_id
  `) as { user_id: string }[];
  if (claimed.length === 0) return false;

  const session = (await sql`
    insert into sessions (user_id, expires_at)
    values (${claimed[0].user_id}, now() + make_interval(days => ${SESSION_DAYS}))
    returning token
  `) as { token: string }[];

  const jar = await cookies();
  jar.set(COOKIE, session[0].token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return true;
}

/** El negocio de quien está en sesión, o null. Única fuente de verdad del panel. */
export async function currentSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const rows = (await sql`
    select u.id as user_id, u.role,
           b.id, b.slug, b.name, b.timezone, b.whatsapp_phone,
           b.booking_window_days, b.min_notice_minutes, b.slot_granularity_minutes
      from sessions s
      join users u on u.id = s.user_id
      join businesses b on b.id = u.business_id
     where s.token = ${token} and s.expires_at > now()
  `) as (PanelBusiness & { user_id: string; role: string })[];

  const r = rows[0];
  if (!r) return null;

  return {
    user_id: r.user_id,
    role: r.role,
    business: {
      id: r.id, slug: r.slug, name: r.name, timezone: r.timezone,
      whatsapp_phone: r.whatsapp_phone, booking_window_days: r.booking_window_days,
      min_notice_minutes: r.min_notice_minutes,
      slot_granularity_minutes: r.slot_granularity_minutes,
    },
  };
}

/** Para las mutaciones: sin sesión no hay negocio, y sin negocio no hay query. */
export async function requireBusiness(): Promise<PanelBusiness> {
  const session = await currentSession();
  if (!session) throw new Error('Sesión expirada');
  return session.business;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from sessions where token = ${token}`;
  jar.delete(COOKIE);
}
