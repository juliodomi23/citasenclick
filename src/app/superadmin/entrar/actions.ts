'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  checkCredentials, makeSessionCookieValue, COOKIE_NAME, SESSION_MAX_AGE_SECONDS,
} from '@/lib/superadmin-auth';

export async function loginSuperadmin(formData: FormData) {
  const user = String(formData.get('user') ?? '');
  const pass = String(formData.get('pass') ?? '');

  if (!checkCredentials(user, pass)) {
    redirect('/superadmin/entrar?error=1');
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, makeSessionCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect('/superadmin');
}

export async function logoutSuperadmin() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect('/superadmin/entrar');
}
