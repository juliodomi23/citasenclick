import { sql } from './db';
import { civilDate } from './dates';

/**
 * Cuando una cita libera un lugar (cancelación o no-show), avisa a quien
 * estaba anotado para ese servicio/día/especialista. Va directo a n8n, igual
 * que el magic link de /entrar: es first-come-first-served, la outbox
 * programada no aplica aquí.
 */
export async function notifyWaitlistIfFreed(appointmentId: string) {
  const rows = (await sql`
    select a.business_id, a.staff_id, a.starts_at,
           b.slug, b.name as business_name, b.timezone,
           s.id as service_id, s.name as service_name
      from appointments a
      join businesses b on b.id = a.business_id
      join services s on s.id = a.service_id
     where a.id = ${appointmentId}
  `) as {
    business_id: string; staff_id: string; starts_at: string;
    slug: string; business_name: string; timezone: string;
    service_id: string; service_name: string;
  }[];
  const appt = rows[0];
  if (!appt) return;

  const webhook = process.env.N8N_WEBHOOK_URL;
  if (!webhook) return;

  const date = civilDate(appt.starts_at, appt.timezone);
  const entries = (await sql`
    update waitlist_entries
       set notified_at = now()
     where business_id = ${appt.business_id} and service_id = ${appt.service_id}
       and date = ${date}::date
       and (staff_id = ${appt.staff_id} or staff_id is null)
       and notified_at is null
    returning customer_name, customer_phone
  `) as { customer_name: string; customer_phone: string }[];
  if (entries.length === 0) return;

  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  const bookingUrl = `${base}/${appt.slug}`;

  await Promise.all(entries.map((e) =>
    fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'waitlist_available',
        nombre: e.customer_name,
        telefono: e.customer_phone,
        servicio: appt.service_name,
        negocio: appt.business_name,
        booking_url: bookingUrl,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {
      // Mejor esfuerzo: si n8n no responde, el cliente se queda sin avisarse
      // esta vez. No hay outbox aquí para reintentar (ver comentario arriba).
    })
  ));
}
