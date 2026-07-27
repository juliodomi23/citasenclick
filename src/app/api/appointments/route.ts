import { DateTime } from 'luxon';
import { sql } from '@/lib/db';
import {
  getBusiness, availableSlots, eligibleStaffIds, slotsByStaff, candidatesForSlot,
  ANY_STAFF, type Business,
} from '@/lib/availability';
import { normalizePhoneMX, isUuid } from '@/lib/validation';
import { isDate } from '@/lib/dates';

type Body = {
  slug?: string; service?: string; staff?: string;
  date?: string; slot?: string;          // slot = instante UTC en ISO
  name?: string; phone?: string; notes?: string;
};

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Body;
  const { slug, service: serviceId, staff: staffId, date, slot } = b;

  if (!slug || !serviceId || !staffId || !date || !slot || !b.name?.trim() || !b.phone) {
    return Response.json({ error: 'faltan datos' }, { status: 400 });
  }
  if (!isDate(date)) {
    return Response.json({ error: 'fecha inválida' }, { status: 400 });
  }
  if (!isUuid(serviceId) || (staffId !== ANY_STAFF && !isUuid(staffId))) {
    return Response.json({ error: 'identificadores inválidos' }, { status: 400 });
  }

  const phone = normalizePhoneMX(b.phone);
  if (!phone) return Response.json({ error: 'teléfono inválido, deben ser 10 dígitos' }, { status: 400 });

  const business = await getBusiness(slug);
  if (!business) return Response.json({ error: 'negocio no encontrado' }, { status: 404 });

  const start = DateTime.fromISO(slot, { zone: 'utc' });
  if (!start.isValid) return Response.json({ error: 'horario inválido' }, { status: 400 });
  const slotISO = start.toISO()!;

  // Nunca confiar en el payload: se recalcula la disponibilidad del lado del
  // servidor. Con "no tengo preferencia" salen varios candidatos, del menos
  // ocupado al más ocupado.
  let candidates: string[];
  if (staffId === ANY_STAFF) {
    const ids = await eligibleStaffIds(business, serviceId);
    const byStaff = await slotsByStaff(business, serviceId, date, ids);
    candidates = await candidatesForSlot(business, byStaff, slotISO, date);
  } else {
    const slots = await availableSlots(business, staffId, serviceId, date);
    candidates = slots.includes(slotISO) ? [staffId] : [];
  }

  if (candidates.length === 0) {
    return Response.json({ error: 'ese horario ya no está disponible' }, { status: 409 });
  }

  const services = (await sql`
    select duration_minutes, buffer_after_minutes from services
     where id = ${serviceId} and business_id = ${business.id} and active
  `) as { duration_minutes: number; buffer_after_minutes: number }[];
  const service = services[0];
  if (!service) return Response.json({ error: 'servicio no encontrado' }, { status: 404 });

  const end = start.plus({ minutes: service.duration_minutes + service.buffer_after_minutes });

  // Se intenta con cada candidato: si dos clientes sin preferencia confirman el
  // mismo segundo, el EXCLUDE rechaza al segundo para ese barbero y se pasa al
  // siguiente que esté libre, en vez de mandarle un 409 innecesario.
  for (const candidate of candidates) {
    try {
      const appt = await insertAppointment({
        business, staffId: candidate, serviceId, start, end,
        name: b.name.trim(), phone, notes: b.notes?.trim() || null,
      });
      const named = (await sql`select name from staff where id = ${candidate}`) as { name: string }[];
      return Response.json(
        { id: appt.id, manage_token: appt.manage_token, staff_name: named[0]?.name },
        { status: 201 }
      );
    } catch (e) {
      // 23P01 = exclusion_violation: ese barbero acaba de ocuparse.
      if ((e as { code?: string }).code !== '23P01') throw e;
    }
  }

  return Response.json({ error: 'ese horario acaba de ocuparse, elige otro' }, { status: 409 });
}

async function insertAppointment(a: {
  business: Business; staffId: string; serviceId: string;
  start: DateTime; end: DateTime; name: string; phone: string; notes: string | null;
}) {
  const rows = (await sql`
    insert into appointments
      (business_id, staff_id, service_id, customer_name, customer_phone, notes, starts_at, ends_at)
    values (${a.business.id}, ${a.staffId}, ${a.serviceId}, ${a.name}, ${a.phone},
            ${a.notes}, ${a.start.toISO()}, ${a.end.toISO()})
    returning id, manage_token
  `) as { id: string; manage_token: string }[];
  const appt = rows[0];

  // Outbox: confirmación ya, recordatorios solo si la cita está lo bastante lejos.
  const now = DateTime.utc();
  const pending: [string, DateTime][] = [['confirmation', now]];
  const r24 = a.start.minus({ hours: 24 });
  const r2 = a.start.minus({ hours: 2 });
  if (r24 > now) pending.push(['reminder_24h', r24]);
  if (r2 > now) pending.push(['reminder_2h', r2]);

  for (const [kind, sendAt] of pending) {
    await sql`
      insert into notifications (appointment_id, kind, send_at)
      values (${appt.id}, ${kind}, ${sendAt.toISO()})
      on conflict do nothing
    `;
  }

  return appt;
}
