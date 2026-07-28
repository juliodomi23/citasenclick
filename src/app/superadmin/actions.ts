'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { isValidSlug, normalizePhoneMX } from '@/lib/validation';
import { TIMEZONES } from '@/lib/panel';

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/**
 * Alta de negocio + su dueño, en una sola pasada. Sustituye escribir SQL a
 * mano por cada cliente del piloto. El dueño queda listo para pedir su
 * primer enlace de acceso en /entrar en cuanto esto termina.
 */
export async function createBusiness(form: FormData) {
  const name = str(form, 'name');
  const slug = str(form, 'slug').toLowerCase();
  const timezone = str(form, 'timezone') || 'America/Mexico_City';
  const rawBizPhone = str(form, 'whatsapp_phone');
  const rawOwnerPhone = str(form, 'owner_phone');

  if (!name || !isValidSlug(slug)) redirect('/superadmin?error=slug');
  if (!TIMEZONES.includes(timezone as (typeof TIMEZONES)[number])) {
    redirect('/superadmin?error=zona');
  }

  const ownerPhone = normalizePhoneMX(rawOwnerPhone);
  if (!ownerPhone) redirect('/superadmin?error=telefono');

  const bizPhone = rawBizPhone ? normalizePhoneMX(rawBizPhone) : null;
  if (rawBizPhone && !bizPhone) redirect('/superadmin?error=telefono-negocio');

  const existing = await sql`select 1 from businesses where slug = ${slug}`;
  if (existing.length > 0) redirect('/superadmin?error=slug-tomado');

  const rows = (await sql`
    insert into businesses (name, slug, timezone, whatsapp_phone)
    values (${name}, ${slug}, ${timezone}, ${bizPhone})
    returning id
  `) as { id: string }[];

  await sql`
    insert into users (business_id, phone, role)
    values (${rows[0].id}, ${ownerPhone}, 'owner')
  `;

  revalidatePath('/superadmin');
  redirect(`/superadmin?ok=${slug}`);
}
