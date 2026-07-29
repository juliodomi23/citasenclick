import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { isDate } from '@/lib/dates';

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
};

/** Una celda de CSV: comillas dobles si trae coma, comilla o salto de línea. */
const csvCell = (v: string) =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

// GET /api/caja/export?from=2026-07-01&to=2026-07-15
// Detrás de la misma sesión del panel: sin token aparte, sin endpoint público.
export async function GET(request: Request) {
  const business = await requireBusiness();
  const q = new URL(request.url).searchParams;
  const from = q.get('from');
  const to = q.get('to');
  if (!from || !to || !isDate(from) || !isDate(to) || from > to) {
    return Response.json({ error: 'rango inválido' }, { status: 400 });
  }

  const ventas = (await sql`
    select s.created_at, s.description, s.qty, s.payment_method, s.total_cents,
           s.commission_cents, st.name as staff_name
      from sales s
      left join staff st on st.id = s.staff_id
     where s.business_id = ${business.id}
       and s.created_at >= (${from}::timestamp at time zone ${business.timezone})
       and s.created_at <  ((${to}::date + 1)::timestamp at time zone ${business.timezone})
     order by s.created_at
  `) as {
    created_at: string; description: string; qty: number; payment_method: string;
    total_cents: number; commission_cents: number; staff_name: string | null;
  }[];

  const fmt = new Intl.DateTimeFormat('es-MX', {
    timeZone: business.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const header = ['Fecha', 'Descripción', 'Cantidad', 'Método', 'Especialista', 'Total', 'Comisión'];
  const rows = ventas.map((v) => [
    fmt.format(new Date(v.created_at)),
    v.description,
    String(v.qty),
    METHOD_LABEL[v.payment_method] ?? v.payment_method,
    v.staff_name ?? 'Venta de mostrador',
    (v.total_cents / 100).toFixed(2),
    (v.commission_cents / 100).toFixed(2),
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  // BOM: sin esto Excel en Windows abre los acentos como caracteres sueltos.
  const body = '﻿' + csv;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="caja_${from}_a_${to}.csv"`,
    },
  });
}
