import { NextResponse, type NextRequest } from 'next/server';
import { secretMatches } from '@/lib/notifications';

/**
 * Basic Auth para /superadmin. Mismo patrón que el resto de los productos
 * internos de Ámbar Rojo (reloj-checador, menu-digital): un solo usuario
 * compartido por variables de entorno, sin tabla de usuarios propia — es
 * para nosotros, no para los negocios.
 *
 * Proxy (antes "middleware", renombrado en Next.js 16) corre siempre en
 * Node.js — ya no hace falta declarar el runtime a mano para tener
 * node:crypto (timingSafeEqual, que usa secretMatches); declararlo ahora
 * revienta el build.
 */
export function proxy(request: NextRequest) {
  const user = process.env.SUPERADMIN_USER;
  const pass = process.env.SUPERADMIN_PASS;

  // Sin credenciales configuradas, la ruta queda cerrada por completo en vez
  // de abierta: un despliegue sin estas variables no debe dejar el alta de
  // negocios al público.
  if (!user || !pass) {
    return new NextResponse('Superadmin no configurado', { status: 503 });
  }

  const auth = request.headers.get('authorization');
  const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

  if (!secretMatches(auth, expected)) {
    return new NextResponse('Autenticación requerida', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="superadmin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/superadmin/:path*',
};
