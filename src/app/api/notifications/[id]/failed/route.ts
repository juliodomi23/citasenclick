import { release, secretMatches } from '@/lib/notifications';

/**
 * Callback de n8n cuando constata que el mensaje NO salió (Meta lo rechazó, la
 * plantilla no está aprobada, etc.). Limpia `sent_at` para que el siguiente
 * ciclo del cron lo reintente.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/notifications/[id]/failed'>) {
  const auth = request.headers.get('authorization');
  if (!secretMatches(auth?.replace(/^Bearer /, '') ?? null, process.env.CRON_SECRET)) {
    return Response.json({ error: 'no autorizado' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return Response.json({ error: 'id inválido' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { error?: string };
  await release(id, body.error ?? 'n8n reportó fallo de envío');

  return Response.json({ requeued: id });
}
