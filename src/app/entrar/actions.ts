'use server';

import { redirect } from 'next/navigation';
import { attemptLogin, createLoginToken, destroySession } from '@/lib/auth';
import { normalizePhoneMX } from '@/lib/validation';

/**
 * Manda el link de setup por WhatsApp (n8n) y devuelve la URL para mostrarla
 * en pantalla en modo piloto. Usado tanto por el login automático (cuando
 * detecta que al usuario le falta contraseña) como por requestLink.
 */
async function sendSetupLink(link: { token: string; name: string; phone: string }) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  const url = `${base}/entrar/${link.token}`;
  const webhook = process.env.N8N_WEBHOOK_URL;

  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'login',
          nombre: link.name,
          telefono: link.phone,
          negocio: link.name,
          setup_url: url,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      console.error('[login] no se pudo enviar el link a n8n');
    }
  } else {
    console.warn(`[login] N8N_WEBHOOK_URL sin configurar. Link de acceso: ${url}`);
  }

  return process.env.SHOW_LOGIN_LINK === 'true' ? url : null;
}

/**
 * Login con número + contraseña. Si el usuario todavía no tiene contraseña
 * (recién dado de alta), en vez de rechazarlo le manda el link para crearla.
 */
export async function login(formData: FormData) {
  const phone = normalizePhoneMX(String(formData.get('phone') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!phone) redirect('/entrar?error=telefono');

  const result = await attemptLogin(phone, password);

  if (result.status === 'ok') redirect('/panel');

  if (result.status === 'needs-setup') {
    const onScreen = await sendSetupLink(result.link);
    redirect(`/entrar?enviado=1${onScreen ? `&link=${encodeURIComponent(onScreen)}` : ''}`);
  }

  redirect('/entrar?error=credenciales');
}

/**
 * Pide un link de acceso por WhatsApp a mano (por si al usuario se le venció
 * o lo perdió). Misma ruta que el envío automático de login().
 */
export async function requestLink(formData: FormData) {
  const phone = normalizePhoneMX(String(formData.get('phone') ?? ''));
  if (!phone) redirect('/entrar?error=telefono');

  const link = await createLoginToken(phone);

  // Respuesta idéntica exista o no el teléfono: privacidad
  let onScreen: string | null = null;
  if (link) onScreen = await sendSetupLink(link);

  redirect(`/entrar?enviado=1${onScreen ? `&link=${encodeURIComponent(onScreen)}` : ''}`);
}

export async function logout() {
  await destroySession();
  redirect('/entrar');
}
