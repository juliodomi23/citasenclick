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
           b.name as business_name, b.whatsapp_phone as business_phone, b.timezone
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

  return {
    kind: n.kind,
    nombre: n.customer_name,
    telefono: n.customer_phone,
    servicio: n.service_name,
    especialista: n.staff_name,
    fecha_local: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
    hora_local: fmt({ hour: '2-digit', minute: '2-digit', hour12: false }),
    negocio: n.business_name,
    negocio_telefono: n.business_phone,
    manage_url: `${baseUrl.replace(/\/$/, '')}/c/${n.manage_token}`,
  };
}

/** Compara secretos sin filtrar la longitud del prefijo correcto por tiempo. */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
