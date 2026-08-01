import { sql } from './db';
import { civilDate } from './dates';
import { availableSlots, type Business } from './availability';

/**
 * Cuántas personas se avisan por cada hueco liberado. No es 1 porque quien
 * recibe el mensaje puede no volver nunca, y el hueco se quedaría muerto
 * esperando a alguien que ya se olvidó. No son todas porque cada mensaje se
 * paga y para un solo hueco los demás sobran. Tres es la apuesta: el hueco se
 * llena rápido sin gastar de más. Se avisa por orden de llegada.
 */
const AVISOS_POR_HUECO = 3;

/**
 * Cuando una cita libera un lugar (cancelación o no-show), avisa a quien
 * estaba anotado para ese servicio/día/especialista. Va directo a n8n, igual
 * que el magic link de /entrar: es first-come-first-served, la outbox
 * programada no aplica aquí.
 */
export async function notifyWaitlistIfFreed(appointmentId: string) {
  const webhook = process.env.N8N_WEBHOOK_URL;
  if (!webhook) return;

  const rows = (await sql`
    select a.staff_id, a.starts_at, a.service_id,
           s.name as service_name,
           b.id, b.slug, b.name, b.timezone, b.min_notice_minutes,
           b.slot_granularity_minutes, b.booking_window_days,
           b.whatsapp_phone, b.logo_url, b.theme
      from appointments a
      join businesses b on b.id = a.business_id
      join services s on s.id = a.service_id
     where a.id = ${appointmentId}
  `) as (Business & {
    staff_id: string; starts_at: string; service_id: string; service_name: string;
  })[];
  const appt = rows[0];
  if (!appt) return;

  const business: Business = appt;
  const date = civilDate(appt.starts_at, appt.timezone);

  // Que la cita se cancele no significa que el hueco sea reservable: si ya
  // pasó la anticipación mínima, nadie puede tomarlo. Sin esta comprobación
  // se manda "se liberó un lugar", la clienta entra y no encuentra nada.
  const slots = await availableSlots(business, appt.staff_id, appt.service_id, date);
  if (slots.length === 0) return;

  // Se reclaman las entradas (notified_at) antes de mandar, para que dos
  // cancelaciones al mismo tiempo no avisen dos veces a la misma persona.
  const entries = (await sql`
    update waitlist_entries
       set notified_at = now()
     where id in (
       select id from waitlist_entries
        where business_id = ${business.id} and service_id = ${appt.service_id}
          and date = ${date}::date
          and (staff_id = ${appt.staff_id} or staff_id is null)
          and notified_at is null
        order by created_at
        limit ${AVISOS_POR_HUECO}
        for update skip locked
     )
    returning id, customer_name, customer_phone
  `) as { id: string; customer_name: string; customer_phone: string }[];
  if (entries.length === 0) return;

  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  const bookingUrl = `${base}/${appt.slug}`;

  await Promise.all(entries.map(async (e) => {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'waitlist_available',
          nombre: e.customer_name,
          telefono: e.customer_phone,
          servicio: appt.service_name,
          negocio: business.name,
          booking_url: bookingUrl,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`n8n respondió ${res.status}`);
    } catch {
      // No salió: se devuelve a la cola para que el siguiente hueco la
      // vuelva a considerar. Sin esto la persona queda marcada como avisada
      // sin haber recibido nada, y nunca se enteraría.
      await sql`update waitlist_entries set notified_at = null where id = ${e.id}`;
    }
  }));
}

/** Borra la espera de días que ya pasaron. Lo llama el cron. */
export async function purgeOldWaitlist() {
  await sql`delete from waitlist_entries where date < current_date`;
}
