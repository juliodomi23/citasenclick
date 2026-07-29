'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql, begin } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { isUuid, normalizePhoneMX } from '@/lib/validation';
import { isDate } from '@/lib/dates';

/**
 * Toda mutación del panel pasa por aquí. El negocio sale de la cookie de sesión,
 * nunca del formulario, y cada query lleva su `business_id`: una sesión no puede
 * tocar datos de otro negocio aunque le manden el id ajeno en el POST.
 */
async function guard(_form: FormData) {
  return { business: await requireBusiness() };
}

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const int = (form: FormData, key: string, fallback = 0) => {
  const n = Number.parseInt(String(form.get(key) ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
};
const isTime = (v: string) => /^\d{2}:\d{2}(:\d{2})?$/.test(v);

const refresh = (section: string) => {
  revalidatePath(`/panel/${section}`);
  revalidatePath('/panel');
  redirect(`/panel/${section}?ok=1`);
};

/* ------------------------------------------------------------------ servicios */

export async function saveService(form: FormData) {
  const { business } = await guard(form);

  const id = str(form, 'id');
  const name = str(form, 'name');
  const duration = int(form, 'duration_minutes');
  const buffer = int(form, 'buffer_after_minutes');
  const pesos = Number.parseFloat(str(form, 'price') || '0');

  // Un servicio de 0 minutos generaría slots infinitos; el precio sí puede ser 0.
  if (!name || duration <= 0 || duration > 720 || buffer < 0 || buffer > 240) return;
  const priceCents = Math.round(Math.max(0, Number.isFinite(pesos) ? pesos : 0) * 100);

  if (id) {
    if (!isUuid(id)) return;
    await sql`
      update services set name = ${name}, duration_minutes = ${duration},
             buffer_after_minutes = ${buffer}, price_cents = ${priceCents}
       where id = ${id} and business_id = ${business.id}
    `;
  } else {
    await sql`
      insert into services (business_id, name, duration_minutes, buffer_after_minutes, price_cents)
      values (${business.id}, ${name}, ${duration}, ${buffer}, ${priceCents})
    `;
  }
  refresh('servicios');
}

export async function toggleService(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  if (!isUuid(id)) return;
  // Sin borrado duro: hay citas que apuntan al servicio y su historial importa.
  await sql`
    update services set active = not active
     where id = ${id} and business_id = ${business.id}
  `;
  refresh('servicios');
}

/* -------------------------------------------------------------------- equipo */

export async function saveStaff(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  const name = str(form, 'name');
  const pct = Number.parseFloat(str(form, 'commission_pct') || '0');
  if (!name) return;
  const commissionPct = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));

  if (id) {
    if (!isUuid(id)) return;
    await sql`
      update staff set name = ${name}, commission_pct = ${commissionPct}
       where id = ${id} and business_id = ${business.id}
    `;
  } else {
    await sql`
      insert into staff (business_id, name, commission_pct)
      values (${business.id}, ${name}, ${commissionPct})
    `;
  }
  refresh('equipo');
}

export async function toggleStaff(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  if (!isUuid(id)) return;
  await sql`
    update staff set active = not active
     where id = ${id} and business_id = ${business.id}
  `;
  refresh('equipo');
}

/** Qué servicios da un especialista. Llegan como checkboxes con el mismo name. */
export async function setStaffServices(form: FormData) {
  const { business } = await guard(form);
  const staffId = str(form, 'staff_id');
  if (!isUuid(staffId)) return;

  const serviceIds = form.getAll('service_ids').map(String).filter(isUuid);

  // Se sustituye el conjunto completo: es lo que envía el formulario.
  await sql`
    delete from staff_services ss
     using staff st
     where ss.staff_id = st.id and st.id = ${staffId} and st.business_id = ${business.id}
  `;
  if (serviceIds.length > 0) {
    await sql`
      insert into staff_services (staff_id, service_id)
      select ${staffId}, s.id from services s
       where s.id = any(${serviceIds}::uuid[]) and s.business_id = ${business.id}
    `;
  }
  refresh('equipo');
}

/* ------------------------------------------------------------------ horarios */

export async function addScheduleRule(form: FormData) {
  const { business } = await guard(form);
  const staffId = str(form, 'staff_id');
  const weekday = int(form, 'weekday', -1);
  const start = str(form, 'start_time');
  const end = str(form, 'end_time');

  if (!isUuid(staffId) || weekday < 0 || weekday > 6) return;
  if (!isTime(start) || !isTime(end) || start >= end) return;

  await sql`
    insert into schedule_rules (staff_id, weekday, start_time, end_time)
    select ${staffId}, ${weekday}, ${start}::time, ${end}::time
      from staff st where st.id = ${staffId} and st.business_id = ${business.id}
  `;
  refresh('horarios');
}

export async function deleteScheduleRule(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  if (!isUuid(id)) return;
  await sql`
    delete from schedule_rules r
     using staff st
     where r.staff_id = st.id and r.id = ${id} and st.business_id = ${business.id}
  `;
  refresh('horarios');
}

/** Copia el horario de un día a los otros seis. Es lo que pide todo negocio. */
export async function copyDayToAll(form: FormData) {
  const { business } = await guard(form);
  const staffId = str(form, 'staff_id');
  const weekday = int(form, 'weekday', -1);
  if (!isUuid(staffId) || weekday < 0 || weekday > 6) return;

  const owned = await sql`
    select 1 from staff where id = ${staffId} and business_id = ${business.id}
  `;
  if (owned.length === 0) return;

  await sql`delete from schedule_rules where staff_id = ${staffId} and weekday <> ${weekday}`;
  await sql`
    insert into schedule_rules (staff_id, weekday, start_time, end_time)
    select ${staffId}, d.weekday, r.start_time, r.end_time
      from schedule_rules r
      cross join generate_series(0, 6) as d(weekday)
     where r.staff_id = ${staffId} and r.weekday = ${weekday} and d.weekday <> ${weekday}
  `;
  refresh('horarios');
}

export async function addOverride(form: FormData) {
  const { business } = await guard(form);
  const staffId = str(form, 'staff_id');
  const date = str(form, 'date');
  const closed = str(form, 'closed') === 'on';
  const start = str(form, 'start_time');
  const end = str(form, 'end_time');
  const reason = str(form, 'reason') || null;

  if (!isUuid(staffId) || !isDate(date)) return;
  if (!closed && (!isTime(start) || !isTime(end) || start >= end)) return;

  await sql`
    insert into schedule_overrides (staff_id, date, start_time, end_time, reason)
    select ${staffId}, ${date}::date,
           ${closed ? null : start}::time, ${closed ? null : end}::time, ${reason}
      from staff st where st.id = ${staffId} and st.business_id = ${business.id}
  `;
  refresh('horarios');
}

export async function deleteOverride(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  if (!isUuid(id)) return;
  await sql`
    delete from schedule_overrides o
     using staff st
     where o.staff_id = st.id and o.id = ${id} and st.business_id = ${business.id}
  `;
  refresh('horarios');
}

/* ------------------------------------------------------------------- ajustes */

export async function saveSettings(form: FormData) {
  const { business } = await guard(form);

  const name = str(form, 'name');
  const timezone = str(form, 'timezone');
  const rawPhone = str(form, 'whatsapp_phone');
  const windowDays = int(form, 'booking_window_days', 30);
  const minNotice = int(form, 'min_notice_minutes', 120);
  const granularity = int(form, 'slot_granularity_minutes', 15);

  if (!name) return;
  // Zona contra lista blanca: un valor inválido rompería el cálculo de slots.
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: timezone });
  } catch {
    return;
  }
  if (windowDays < 1 || windowDays > 180) return;
  if (minNotice < 0 || minNotice > 10080) return;
  if (![5, 10, 15, 20, 30, 60].includes(granularity)) return;

  const phone = rawPhone ? normalizePhoneMX(rawPhone) : null;

  await sql`
    update businesses
       set name = ${name}, timezone = ${timezone}, whatsapp_phone = ${phone},
           booking_window_days = ${windowDays}, min_notice_minutes = ${minNotice},
           slot_granularity_minutes = ${granularity}
     where id = ${business.id}
  `;
  refresh('ajustes');
}

/* ---------------------------------------------------------------- inventario */

export async function saveProduct(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  const name = str(form, 'name');
  const pesos = Number.parseFloat(str(form, 'price') || '0');
  const stock = int(form, 'stock', 0);

  if (!name || stock < 0) return;
  const priceCents = Math.round(Math.max(0, Number.isFinite(pesos) ? pesos : 0) * 100);

  if (id) {
    if (!isUuid(id)) return;
    await sql`
      update products set name = ${name}, price_cents = ${priceCents}, stock = ${stock}
       where id = ${id} and business_id = ${business.id}
    `;
  } else {
    await sql`
      insert into products (business_id, name, price_cents, stock)
      values (${business.id}, ${name}, ${priceCents}, ${stock})
    `;
  }
  refresh('inventario');
}

export async function toggleProduct(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  if (!isUuid(id)) return;
  // Sin borrado duro: ventas pasadas siguen apuntando al producto.
  await sql`
    update products set active = not active
     where id = ${id} and business_id = ${business.id}
  `;
  refresh('inventario');
}

/* --------------------------------------------------------------------- caja */

const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'];

/** Cobra una cita: la marca como atendida y registra el ingreso en el corte de caja. */
export async function completeAppointment(form: FormData) {
  const { business } = await guard(form);
  const id = str(form, 'id');
  const date = str(form, 'date');
  const view = str(form, 'view');
  const staffFilter = str(form, 'staff');
  const method = str(form, 'payment_method');
  const pesos = Number.parseFloat(str(form, 'amount') || '0');

  if (!isUuid(id) || !PAYMENT_METHODS.includes(method)) return;
  const amountCents = Math.round(Math.max(0, Number.isFinite(pesos) ? pesos : 0) * 100);

  const rows = (await sql`
    select a.staff_id, s.name as service_name, st.commission_pct
      from appointments a
      join services s on s.id = a.service_id
      join staff st on st.id = a.staff_id
     where a.id = ${id} and a.business_id = ${business.id} and a.status = 'confirmed'
  `) as { staff_id: string; service_name: string; commission_pct: string }[];
  const appt = rows[0];
  if (!appt) return;
  const commissionCents = Math.round(amountCents * (Number(appt.commission_pct) / 100));

  await begin(async (tx) => {
    await tx`update appointments set status = 'completed' where id = ${id}`;
    await tx`
      insert into sales
        (business_id, staff_id, appointment_id, description, payment_method, total_cents, commission_cents)
      values
        (${business.id}, ${appt.staff_id}, ${id}, ${appt.service_name}, ${method}, ${amountCents}, ${commissionCents})
    `;
  });

  revalidatePath('/panel');
  revalidatePath('/panel/caja');
  const back = `/panel?date=${date}&view=${view}${staffFilter && isUuid(staffFilter) ? `&staff=${staffFilter}` : ''}`;
  redirect(back);
}

/** Venta de un producto suelto (sin cita): descuenta stock y registra el cobro. */
export async function sellProduct(form: FormData) {
  const { business } = await guard(form);
  const productId = str(form, 'product_id');
  const qty = int(form, 'qty', 1);
  const method = str(form, 'payment_method');
  const date = str(form, 'date');

  if (!isUuid(productId) || qty <= 0 || !PAYMENT_METHODS.includes(method)) return;

  const rows = (await sql`
    select name, price_cents from products
     where id = ${productId} and business_id = ${business.id} and active
  `) as { name: string; price_cents: number }[];
  const product = rows[0];
  if (!product) return;

  const totalCents = product.price_cents * qty;

  await begin(async (tx) => {
    await tx`
      insert into sales (business_id, product_id, description, qty, payment_method, total_cents)
      values (${business.id}, ${productId}, ${product.name}, ${qty}, ${method}, ${totalCents})
    `;
    // No vende de más: si piden más de lo que hay, se queda en 0 en vez de negativo.
    await tx`update products set stock = greatest(stock - ${qty}, 0) where id = ${productId}`;
  });

  revalidatePath('/panel/caja');
  revalidatePath('/panel/inventario');
  redirect(`/panel/caja?date=${date}&ok=1`);
}
