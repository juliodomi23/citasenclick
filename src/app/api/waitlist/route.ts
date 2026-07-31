import { sql } from '@/lib/db';
import { getBusiness, ANY_STAFF } from '@/lib/availability';
import { normalizePhoneMX, isUuid } from '@/lib/validation';
import { isDate } from '@/lib/dates';

type Body = {
  slug?: string; service?: string; staff?: string; date?: string;
  name?: string; phone?: string;
};

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Body;
  const { slug, service: serviceId, staff: staffId, date } = b;

  if (!slug || !serviceId || !staffId || !date || !b.name?.trim() || !b.phone) {
    return Response.json({ error: 'faltan datos' }, { status: 400 });
  }
  if (!isDate(date)) return Response.json({ error: 'fecha inválida' }, { status: 400 });
  if (!isUuid(serviceId) || (staffId !== ANY_STAFF && !isUuid(staffId))) {
    return Response.json({ error: 'identificadores inválidos' }, { status: 400 });
  }

  const phone = normalizePhoneMX(b.phone);
  if (!phone) return Response.json({ error: 'teléfono inválido, deben ser 10 dígitos' }, { status: 400 });

  const business = await getBusiness(slug);
  if (!business) return Response.json({ error: 'negocio no encontrado' }, { status: 404 });

  const services = (await sql`
    select id from services where id = ${serviceId} and business_id = ${business.id} and active
  `) as { id: string }[];
  if (!services[0]) return Response.json({ error: 'servicio no encontrado' }, { status: 404 });

  await sql`
    insert into waitlist_entries (business_id, staff_id, service_id, customer_name, customer_phone, date)
    values (${business.id}, ${staffId === ANY_STAFF ? null : staffId}, ${serviceId},
            ${b.name.trim()}, ${phone}, ${date}::date)
  `;

  return Response.json({ ok: true }, { status: 201 });
}
