import { claimDue, buildPayload, release, recordError, secretMatches } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Drena la outbox de WhatsApp. Lo dispara Vercel Cron (o un Schedule Trigger de
 * n8n) cada 5 minutos — ver vercel.json.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!secretMatches(auth?.replace(/^Bearer /, '') ?? null, process.env.CRON_SECRET)) {
    return Response.json({ error: 'no autorizado' }, { status: 401 });
  }

  const webhook = process.env.N8N_WEBHOOK_URL;
  if (!webhook) {
    // Sin webhook no se reclama nada: si no, las notificaciones se marcarían
    // como enviadas y nadie recibiría su recordatorio.
    return Response.json({ skipped: 'N8N_WEBHOOK_URL sin configurar' });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
  const due = await claimDue();

  let sent = 0;
  const failed: string[] = [];

  for (const n of due) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(n, baseUrl)),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        sent++;
      } else {
        // Respondió pero rechazó: puede haber enviado igual. Se anota el error y
        // NO se reencola — que n8n llame a /failed si constata que no salió.
        await recordError(n.id, `n8n respondió ${res.status}`);
        failed.push(n.id);
      }
    } catch (e) {
      // La petición no llegó a completarse: aquí sí consta que n8n no la recibió,
      // así que vuelve a la cola para el siguiente ciclo.
      await release(n.id, e instanceof Error ? e.message : 'fallo de red');
      failed.push(n.id);
    }
  }

  return Response.json({ claimed: due.length, sent, failed: failed.length });
}
