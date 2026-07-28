'use server';

import { redirect } from 'next/navigation';
import { setupPasswordAndLogin, validatePassword } from '@/lib/auth';

export async function setupPassword(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!validatePassword(password)) {
    redirect(`/entrar/${token}?error=invalid`);
  }

  const ok = await setupPasswordAndLogin(token, password);
  if (!ok) {
    redirect(`/entrar/${token}?error=expired`);
  }

  redirect('/panel');
}
