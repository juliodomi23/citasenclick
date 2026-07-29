'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { isValidSlug, normalizePhoneMX } from '@/lib/validation';
import { TIMEZONES, THEMES } from '@/lib/panel';

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
  const logoUrl = str(form, 'logo_url');
  const theme = str(form, 'theme') || 'rosa';

  if (!name || !isValidSlug(slug)) redirect('/superadmin?error=slug');
  if (!TIMEZONES.includes(timezone as (typeof TIMEZONES)[number])) {
    redirect('/superadmin?error=zona');
  }
  if (!THEMES.includes(theme as (typeof THEMES)[number])) redirect('/superadmin?error=zona');

  const ownerPhone = normalizePhoneMX(rawOwnerPhone);
  if (!ownerPhone) redirect('/superadmin?error=telefono');

  const bizPhone = rawBizPhone ? normalizePhoneMX(rawBizPhone) : null;
  if (rawBizPhone && !bizPhone) redirect('/superadmin?error=telefono-negocio');

  const existing = await sql`select 1 from businesses where slug = ${slug}`;
  if (existing.length > 0) redirect('/superadmin?error=slug-tomado');

  const rows = (await sql`
    insert into businesses (name, slug, timezone, whatsapp_phone, logo_url, theme)
    values (${name}, ${slug}, ${timezone}, ${bizPhone}, ${logoUrl || null}, ${theme})
    returning id
  `) as { id: string }[];

  await sql`
    insert into users (business_id, phone, role)
    values (${rows[0].id}, ${ownerPhone}, 'owner')
  `;

  revalidatePath('/superadmin');
  redirect(`/superadmin?ok=${slug}`);
}

/**
 * Elimina un negocio completo: toda la cascada (usuarios, citas, servicios, etc).
 * ON DELETE CASCADE se encarga del resto.
 */
export async function deleteBusiness(form: FormData) {
  const slug = str(form, 'slug');

  if (!slug || !isValidSlug(slug)) redirect('/superadmin?error=slug');

  const business = (await sql`
    select id from businesses where slug = ${slug}
  `) as { id: string }[];

  if (business.length === 0) redirect('/superadmin?error=no-existe');

  await sql`delete from businesses where slug = ${slug}`;

  revalidatePath('/superadmin');
  redirect(`/superadmin?deleted=${slug}`);
}

/**
 * Marca de un negocio: nombre, logo y tema de color. Aparte de crear/borrar
 * porque se edita muchas veces después del alta y no toca ni horarios ni
 * teléfonos — solo lo que ve la clienta.
 */
export async function updateBranding(form: FormData) {
  const slug = str(form, 'slug');
  const name = str(form, 'name');
  const logoUrl = str(form, 'logo_url');
  const theme = str(form, 'theme');

  if (!slug || !isValidSlug(slug)) redirect('/superadmin?error=slug');
  if (!name) redirect('/superadmin?error=slug');
  if (!THEMES.includes(theme as (typeof THEMES)[number])) redirect('/superadmin?error=zona');

  await sql`
    update businesses
       set name = ${name}, logo_url = ${logoUrl || null}, theme = ${theme}
     where slug = ${slug}
  `;

  revalidatePath('/superadmin');
  revalidatePath('/panel');
  revalidatePath('/[slug]', 'page');
  redirect(`/superadmin?ok=${slug}`);
}
