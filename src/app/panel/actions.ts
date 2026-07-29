'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { isUuid } from '@/lib/validation';
import { requireBusiness } from '@/lib/auth';

const ALLOWED = ['confirmed', 'cancelled', 'no_show', 'completed'] as const;
type Status = (typeof ALLOWED)[number];

export async function setStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as Status;
  const date = String(formData.get('date') ?? '');
  const view = String(formData.get('view') ?? '');
  const staff = formData.get('staff');

  if (!isUuid(id) || !ALLOWED.includes(status)) return;

  const business = await requireBusiness();
  const back = `/panel?date=${date}&view=${view}${staff && isUuid(String(staff)) ? `&staff=${staff}` : ''}`;

  try {
    // El business_id viene de la sesión: una cuenta solo puede tocar citas de
    // su propio negocio, aunque le manden el id de otro.
    await sql`
      update appointments set status = ${status}
       where id = ${id} and business_id = ${business.id}
    `;
  } catch (e) {
    // 23P01: reactivar una cita cuyo hueco ya se revendió. El EXCLUDE lo impide
    // y está bien que lo impida — la cita nueva es la que vale.
    if ((e as { code?: string }).code === '23P01') {
      redirect(`${back}&error=ocupado`);
    }
    throw e;
  }

  revalidatePath('/panel');
  redirect(back);
}
