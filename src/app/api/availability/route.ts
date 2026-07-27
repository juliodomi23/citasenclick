import {
  getBusiness, availableSlots, eligibleStaffIds, slotsByStaff, unionSlots, ANY_STAFF,
} from '@/lib/availability';
import { isUuid } from '@/lib/validation';
import { isDate } from '@/lib/dates';

// GET /api/availability?slug=barberia-demo&service=<uuid>&staff=<uuid|any>&date=2026-08-05
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slug = q.get('slug');
  const serviceId = q.get('service');
  const staffId = q.get('staff');
  const date = q.get('date');

  if (!slug || !serviceId || !staffId || !date) {
    return Response.json({ error: 'faltan parámetros' }, { status: 400 });
  }
  if (!isDate(date)) {
    return Response.json({ error: 'fecha inválida' }, { status: 400 });
  }
  if (!isUuid(serviceId) || (staffId !== ANY_STAFF && !isUuid(staffId))) {
    return Response.json({ error: 'identificadores inválidos' }, { status: 400 });
  }

  const business = await getBusiness(slug);
  if (!business) return Response.json({ error: 'negocio no encontrado' }, { status: 404 });

  const slots =
    staffId === ANY_STAFF
      ? unionSlots(
          await slotsByStaff(business, serviceId, date, await eligibleStaffIds(business, serviceId))
        )
      : await availableSlots(business, staffId, serviceId, date);

  return Response.json({ timezone: business.timezone, slots });
}
