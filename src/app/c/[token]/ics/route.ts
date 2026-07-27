import { sql } from '@/lib/db';
import { buildIcs } from '@/lib/ics';

type Row = {
  manage_token: string; starts_at: string; ends_at: string; status: string;
  buffer_after_minutes: number; service_name: string; staff_name: string;
  business_name: string; business_phone: string | null;
};

/**
 * El .ics de una cita. Se identifica con el mismo `manage_token` del enlace de
 * WhatsApp: quien tiene el enlace ya puede ver y cancelar la cita.
 */
export async function GET(request: Request, ctx: RouteContext<'/c/[token]/ics'>) {
  const { token } = await ctx.params;

  const rows = (await sql`
    select a.manage_token, a.starts_at, a.ends_at, a.status,
           s.buffer_after_minutes, s.name as service_name,
           st.name as staff_name, b.name as business_name, b.whatsapp_phone as business_phone
      from appointments a
      join services s on s.id = a.service_id
      join staff st on st.id = a.staff_id
      join businesses b on b.id = a.business_id
     where a.manage_token = ${token}
  `) as Row[];

  const a = rows[0];
  if (!a) return new Response('No encontrada', { status: 404 });

  // `ends_at` incluye el tiempo de limpieza, que es asunto del negocio. En el
  // calendario de la clienta la cita termina cuando termina su servicio.
  const end = new Date(new Date(a.ends_at).getTime() - a.buffer_after_minutes * 60_000);

  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
  const manageUrl = `${origin.replace(/\/$/, '')}/c/${a.manage_token}`;

  const ics = buildIcs({
    uid: `${a.manage_token}@cita-en-click`,
    start: new Date(a.starts_at),
    end,
    summary: `${a.service_name} — ${a.business_name}`,
    description: [
      `Con ${a.staff_name}.`,
      a.business_phone ? `WhatsApp del negocio: ${a.business_phone}` : null,
      `Ver o cancelar: ${manageUrl}`,
    ].filter(Boolean).join('\n'),
    location: a.business_name,
    cancelled: a.status === 'cancelled',
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cita.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
