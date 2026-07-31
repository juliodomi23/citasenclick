'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { notifyWaitlistIfFreed } from '@/lib/waitlist';

export async function cancelAppointment(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  if (!token) return;

  // La ventana mínima se revalida aquí: la UI no es la autoridad.
  const rows = (await sql`
    update appointments a
       set status = 'cancelled'
      from businesses b
     where b.id = a.business_id
       and a.manage_token = ${token}
       and a.status = 'confirmed'
       and a.starts_at > now() + make_interval(mins => b.min_notice_minutes)
    returning a.id
  `) as { id: string }[];

  // Cancelar libera el slot solo (el EXCLUDE es parcial sobre 'confirmed').
  if (rows[0]) {
    await sql`
      insert into notifications (appointment_id, kind, send_at)
      values (${rows[0].id}, 'cancelled', now())
      on conflict do nothing
    `;
    await notifyWaitlistIfFreed(rows[0].id);
  }

  revalidatePath(`/c/${token}`);
}
