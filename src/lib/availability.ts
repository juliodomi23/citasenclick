import { DateTime } from 'luxon';
import { sql } from './db';
import { computeSlots, type LocalWindow, type Busy } from './slots';

export * from './slots';

/** Ventana horaria efectiva del día: override si existe, si no la regla semanal. */
export async function windowsForDate(staffId: string, date: string, timezone: string): Promise<LocalWindow[]> {
  const overrides = (await sql`
    select start_time, end_time from schedule_overrides
     where staff_id = ${staffId} and date = ${date}
  `) as { start_time: string | null; end_time: string | null }[];

  if (overrides.length > 0) {
    // NULL + NULL = día cerrado completo.
    return overrides
      .filter((o) => o.start_time && o.end_time)
      .map((o) => ({ start_time: o.start_time!, end_time: o.end_time! }));
  }

  const weekday = DateTime.fromISO(date, { zone: timezone }).weekday % 7; // luxon: 1=lun..7=dom -> 0=dom
  return (await sql`
    select start_time, end_time from schedule_rules
     where staff_id = ${staffId} and weekday = ${weekday}
     order by start_time
  `) as LocalWindow[];
}

export type Business = {
  id: string; slug: string; name: string; timezone: string;
  whatsapp_phone: string | null; booking_window_days: number;
  min_notice_minutes: number; slot_granularity_minutes: number;
};

export async function getBusiness(slug: string): Promise<Business | null> {
  const rows = (await sql`select * from businesses where slug = ${slug}`) as Business[];
  return rows[0] ?? null;
}

/** Slots disponibles de un especialista para un servicio en un día. */
export async function availableSlots(
  business: Business, staffId: string, serviceId: string, date: string
): Promise<string[]> {
  const services = (await sql`
    select duration_minutes, buffer_after_minutes from services
     where id = ${serviceId} and business_id = ${business.id} and active
  `) as { duration_minutes: number; buffer_after_minutes: number }[];
  const service = services[0];
  if (!service) return [];

  const windows = await windowsForDate(staffId, date, business.timezone);
  if (windows.length === 0) return [];

  // Margen de un día a cada lado: una ventana local puede cruzar medianoche UTC.
  const busy = (await sql`
    select starts_at, ends_at from appointments
     where staff_id = ${staffId} and status = 'confirmed'
       and starts_at >= ${date}::date - 1 and starts_at < ${date}::date + 2
  `) as Busy[];

  return computeSlots({
    date,
    timezone: business.timezone,
    windows,
    busy,
    durationMinutes: service.duration_minutes,
    bufferMinutes: service.buffer_after_minutes,
    granularityMinutes: business.slot_granularity_minutes,
    minNoticeMinutes: business.min_notice_minutes,
  });
}

/** Marca de "no tengo preferencia" en la URL y el payload. No es un uuid. */
export const ANY_STAFF = 'any';

/** Especialistas activos que dan ese servicio, en orden estable. */
export async function eligibleStaffIds(business: Business, serviceId: string): Promise<string[]> {
  const rows = (await sql`
    select st.id from staff st
      join staff_services ss on ss.staff_id = st.id
     where st.business_id = ${business.id} and st.active and ss.service_id = ${serviceId}
     order by st.name
  `) as { id: string }[];
  return rows.map((r) => r.id);
}

/**
 * Slots de cada especialista. La unión es lo que se le ofrece a quien no tiene
 * preferencia; el mapa es lo que permite saber después quién puede atenderlo.
 * ponytail: una query por especialista. Con 2-5 barberos no vale la pena una
 * query única con lateral joins; si un negocio llega a 20, ahí se optimiza.
 */
export async function slotsByStaff(
  business: Business, serviceId: string, date: string, staffIds: string[]
): Promise<Map<string, string[]>> {
  const entries = await Promise.all(
    staffIds.map(async (id) => [id, await availableSlots(business, id, serviceId, date)] as const)
  );
  return new Map(entries);
}

export const unionSlots = (byStaff: Map<string, string[]>): string[] =>
  [...new Set([...byStaff.values()].flat())].sort();

/**
 * Quién puede tomar ese slot, del menos ocupado ese día al más ocupado.
 * Sin esto, "no tengo preferencia" le carga todas las citas al primero de la
 * lista alfabética y el otro especialista se queda sin trabajo.
 */
export async function candidatesForSlot(
  business: Business, byStaff: Map<string, string[]>, slotISO: string, date: string
): Promise<string[]> {
  const free = [...byStaff.entries()].filter(([, slots]) => slots.includes(slotISO)).map(([id]) => id);
  if (free.length <= 1) return free;

  const load = (await sql`
    select staff_id, count(*)::int as n from appointments
     where staff_id = any(${free}::uuid[]) and status = 'confirmed'
       and starts_at >= (${date}::timestamp at time zone ${business.timezone})
       and starts_at <  ((${date}::date + 1)::timestamp at time zone ${business.timezone})
     group by staff_id
  `) as { staff_id: string; n: number }[];

  const count = new Map(load.map((r) => [r.staff_id, r.n]));
  return free.sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0));
}
