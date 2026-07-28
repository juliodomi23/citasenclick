import { getBusiness, availableDates, ANY_STAFF } from '@/lib/availability';
import { isUuid } from '@/lib/validation';
import { isDate } from '@/lib/dates';

// GET /api/availability/days?slug=barberia-demo&service=<uuid>&staff=<uuid|any>&dates=2026-08-05,2026-08-06,...
// Filtra una lista de fechas a solo las que tienen al menos un horario libre.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slug = q.get('slug');
  const serviceId = q.get('service');
  const staffId = q.get('staff');
  const dates = q.get('dates')?.split(',').filter(Boolean) ?? [];

  if (!slug || !serviceId || !staffId || dates.length === 0) {
    return Response.json({ error: 'faltan parámetros' }, { status: 400 });
  }
  if (!dates.every(isDate)) {
    return Response.json({ error: 'fecha inválida' }, { status: 400 });
  }
  if (!isUuid(serviceId) || (staffId !== ANY_STAFF && !isUuid(staffId))) {
    return Response.json({ error: 'identificadores inválidos' }, { status: 400 });
  }

  const business = await getBusiness(slug);
  if (!business) return Response.json({ error: 'negocio no encontrado' }, { status: 404 });

  const dias = await availableDates(business, staffId, serviceId, dates);
  return Response.json({ dates: dias });
}
