'use server';

import { redirect } from 'next/navigation';
import { createLoginToken, loginWithPassword, destroySession } from '@/lib/auth';
import { normalizePhoneMX } from '@/lib/validation';

/**
 * Login con número + contraseña
 */
export async function login(formData: FormData) {
  const phone = normalizePhoneMX(String(formData.get('phone') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!phone) redirect('/entrar?error=telefono');

  const ok = await loginWithPassword(phone, password);
  if (!ok) redirect('/entrar?error=credenciales');

  redirect('/panel');
}

/**
 * Pide un link de acceso por WhatsApp (primera vez). Va directo al webhook de n8n.
 */
export async function requestLink(formData: FormData) {
  const phone = normalizePhoneMX(String(formData.get('phone') ?? ''));
  if (!phone) redirect('/entrar?error=telefono');

  const link = await createLoginToken(phone);

  // Respuesta idéntica exista o no el teléfono: privacidad
  let onScreen: string | null = null;

  if (link) {
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

    if (process.env.SHOW_LOGIN_LINK === 'true') onScreen = url;
  }

  redirect(`/entrar?enviado=1${onScreen ? `&link=${encodeURIComponent(onScreen)}` : ''}`);
}

export async function logout() {
  await destroySession();
  redirect('/entrar');
}
