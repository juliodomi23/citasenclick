import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, isValidSessionCookie } from '@/lib/superadmin-auth';

/**
 * Protege /superadmin con una sesión propia (formulario + cookie), no con
 * Basic Auth del navegador — ese mecanismo se rompía detrás de Cloudflare en
 * más de un navegador (ver src/lib/superadmin-auth.ts). /superadmin/entrar
 * es la única ruta abierta bajo /superadmin: ahí se pide la contraseña.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/superadmin/entrar') return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) {
    return NextResponse.redirect(new URL('/superadmin/entrar', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/superadmin/:path*',
};
