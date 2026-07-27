import { redirect } from 'next/navigation';
import { consumeLoginToken } from '@/lib/auth';

/**
 * Canjea el link de acceso por una sesión.
 * Es una ruta GET porque se abre desde WhatsApp, pero el token es de un solo
 * uso y vence en 15 minutos: si un previsualizador de enlaces lo abre antes que
 * la persona, se quema y hay que pedir otro. Es el precio de que el link se
 * pueda tocar desde el chat.
 */
export async function GET(_request: Request, ctx: RouteContext<'/entrar/[token]'>) {
  const { token } = await ctx.params;

  const ok = /^[0-9a-f]{32}$/.test(token) && (await consumeLoginToken(token));
  redirect(ok ? '/panel' : '/entrar?error=caducado');
}
