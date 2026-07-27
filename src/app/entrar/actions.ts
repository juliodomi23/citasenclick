'use server';

import { redirect } from 'next/navigation';
import { createLoginToken, destroySession } from '@/lib/auth';
import { normalizePhoneMX } from '@/lib/validation';

/**
 * Pide un link de acceso por WhatsApp. Va directo al webhook de n8n, sin pasar
 * por la outbox: quien pide un link está esperando frente a la pantalla, y el
 * cron corre cada 5 minutos.
 */
export async function requestLink(formData: FormData) {
  const phone = normalizePhoneMX(String(formData.get('phone') ?? ''));
  if (!phone) redirect('/entrar?error=telefono');

  const link = await createLoginToken(phone);

  // Respuesta idéntica exista o no el teléfono: si no, la pantalla se convierte
  // en un detector de qué números están dados de alta.
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
            manage_url: url,
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Se traga el error a propósito: decir "no se pudo enviar" delataría
        // que el teléfono sí existe. Queda en el log del servidor.
        console.error('[login] no se pudo enviar el link a n8n');
      }
    } else {
      console.warn(`[login] N8N_WEBHOOK_URL sin configurar. Link de acceso: ${url}`);
    }

    // Piloto sin n8n armado: en vez de depender de que alguien saque el link
    // de los logs del VPS, el dueño se autoatiende. Se apaga poniendo
    // SHOW_LOGIN_LINK≠"true" en cuanto n8n esté enviando por WhatsApp de verdad.
    // Aceptable con la base de usuarios chica y conocida del piloto: solo hay
    // cuenta para los negocios que nosotros mismos dimos de alta.
    if (process.env.SHOW_LOGIN_LINK === 'true') onScreen = url;
  }

  redirect(`/entrar?enviado=1${onScreen ? `&link=${encodeURIComponent(onScreen)}` : ''}`);
}

export async function logout() {
  await destroySession();
  redirect('/entrar');
}
