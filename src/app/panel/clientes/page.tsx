import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { Card, Empty } from '@/components/panel-ui';

type Cliente = {
  customer_phone: string; customer_name: string; visitas: number;
  ultima_visita: string; gasto_total: number;
};

const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export default async function Clientes() {
  const business = await requireBusiness();

  // El teléfono ya es el identificador único de cada clienta (así entra al
  // "gestionar mi cita" y así se agrupan sus citas): no hace falta una tabla
  // customers aparte, se calcula al vuelo desde appointments + sales.
  const clientes = (await sql`
    select a.customer_phone,
           (array_agg(a.customer_name order by a.starts_at desc))[1] as customer_name,
           count(distinct a.id)::int as visitas,
           max(a.starts_at) as ultima_visita,
           coalesce(sum(s.total_cents), 0)::int as gasto_total
      from appointments a
      left join sales s on s.appointment_id = a.id
     where a.business_id = ${business.id}
     group by a.customer_phone
     order by ultima_visita desc
  `) as Cliente[];

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('es-MX', { timeZone: business.timezone, day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(iso));

  return (
    <main className="mt-6 space-y-4">
      {clientes.length === 0 ? (
        <Empty>Aún no hay clientas con citas.</Empty>
      ) : (
        <Card>
          <ul className="divide-y divide-blush-100">
            {clientes.map((c) => (
              <li key={c.customer_phone}>
                <Link
                  href={`/panel/clientes/${encodeURIComponent(c.customer_phone)}`}
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-3 transition-colors duration-200 hover:text-accent-700"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{c.customer_name}</p>
                    <p className="text-sm text-ink-muted">
                      {c.customer_phone} · {c.visitas} visita{c.visitas === 1 ? '' : 's'} · última {fmt(c.ultima_visita)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-ink">{money(c.gasto_total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
