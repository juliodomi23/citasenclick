import { timingSafeEqual } from 'node:crypto';
import { sql } from './db';

export type DueNotification = {
  id: string;
  kind: string;
  customer_name: string;
  customer_phone: string;
  starts_at: string;
  service_name: string;
  staff_name: string;
  business_name: string;
  business_phone: string | null;
  review_url: string | null;
  timezone: string;
  manage_token: string;
};

/**
 * Reclama hasta `limit` notificaciones vencidas y las marca como enviadas
 * **antes** de mandarlas. En mensajería, mandar de menos es mejor que mandar
 * doble: un cliente que recibe cuatro recordatorios del mismo corte bloquea el
 * número. `skip locked` permite varios workers sin que se pisen.
 */
export async function claimDue(limit = 50): Promise<DueNotification[]> {
  const claimed = (await sql`
    update notifications n
       set sent_at = now()
      from (
        select id from notifications
         where sent_at is null and send_at <= now()
         order by send_at
         limit ${limit}
         for update skip locked
      ) due
     where n.id = due.id
    returning n.id
  `) as { id: string }[];

  if (claimed.length === 0) return [];

  return (await sql`
    select n.id::text, n.kind, a.customer_name, a.customer_phone, a.starts_at,
           a.manage_token, s.name as service_name, st.name as staff_name,
           b.name as business_name, b.whatsapp_phone as business_phone,
           b.review_url, b.timezone
      from notifications n
      join appointments a on a.id = n.appointment_id
      join services s on s.id = a.service_id
      join staff st on st.id = a.staff_id
      join businesses b on b.id = a.business_id
     where n.id = any(${claimed.map((c) => c.id)}::bigint[])
     order by n.id
  `) as DueNotification[];
}

/** Devuelve una notificación a la cola. Solo para fallos donde consta que no salió. */
export async function release(id: string, error: string) {
  await sql`
    update notifications set sent_at = null, error = ${error.slice(0, 500)}
     where id = ${id}::bigint
  `;
}

export async function recordError(id: string, error: string) {
  await sql`update notifications set error = ${error.slice(0, 500)} where id = ${id}::bigint`;
}

/**
 * Payload plano para n8n. La app no habla con Meta: n8n arma la plantilla,
 * reintenta y registra en Chatwoot (ARQUITECTURA.md §1.2).
 * Las fechas van ya formateadas en la zona del negocio — n8n no debe hacer
 * aritmética de zonas horarias.
 */
export function buildPayload(n: DueNotification, baseUrl: string) {
  const at = new Date(n.starts_at);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-MX', { timeZone: n.timezone, ...opts }).format(at);

  // 'new_booking_alert' avisa al negocio (número propio de Ámbar Rojo, plantilla
  // distinta en n8n); el resto de kinds va al cliente.
  const telefono = n.kind === 'new_booking_alert' ? n.business_phone : n.customer_phone;

  return {
    id: n.id,
    kind: n.kind,
    nombre: n.customer_name,
    telefono,
    cliente_telefono: n.customer_phone,
    servicio: n.service_name,
    especialista: n.staff_name,
    fecha_local: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
    hora_local: fmt({ hour: '2-digit', minute: '2-digit', hour12: false }),
    negocio: n.business_name,
    negocio_telefono: n.business_phone,
    manage_url: `${baseUrl.replace(/\/$/, '')}/c/${n.manage_token}`,
    review_url: n.review_url,
  };
}

/**
 * Al marcar una cita como atendida, programa lo que dependa de ese servicio:
 * pedir reseña (unas horas después) y recordar el próximo corte (si el
 * servicio tiene `rebook_after_days`). Ambos van por la outbox normal, no
 * directo a n8n — no son urgentes como el login o la lista de espera.
 */
export async function scheduleCompletionNotifications(appointmentId: string) {
  const rows = (await sql`
    select a.starts_at, s.rebook_after_days, b.review_url
      from appointments a
      join services s on s.id = a.service_id
      join businesses b on b.id = a.business_id
     where a.id = ${appointmentId}
  `) as { starts_at: string; rebook_after_days: number | null; review_url: string | null }[];
  const appt = rows[0];
  if (!appt) return;

  const pending: [string, Date][] = [];
  if (appt.review_url) pending.push(['review_request', new Date(Date.now() + 2 * 60 * 60_000)]);
  if (appt.rebook_after_days) {
    const sendAt = new Date(new Date(appt.starts_at).getTime() + appt.rebook_after_days * 86_400_000);
    pending.push(['rebook_reminder', sendAt]);
  }

  for (const [kind, sendAt] of pending) {
    await sql`
      insert into notifications (appointment_id, kind, send_at)
      values (${appointmentId}, ${kind}, ${sendAt.toISOString()})
      on conflict do nothing
    `;
  }
}

/** Compara secretos sin filtrar la longitud del prefijo correcto por tiempo. */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
