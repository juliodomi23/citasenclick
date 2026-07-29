import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { Card, Empty } from '@/components/panel-ui';
import { MessageCircle } from '@/components/icons';

type Cita = {
  id: string; starts_at: string; status: string; service_name: string;
  staff_name: string; total_cents: number | null; customer_name: string;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada', cancelled: 'Cancelada', no_show: 'No llegó', completed: 'Atendida',
};

const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export default async function ClienteDetalle(props: PageProps<'/panel/clientes/[phone]'>) {
  const business = await requireBusiness();
  // Esta versión de Next no decodifica el segmento dinámico: llega tal cual
  // el "%2B" de la URL, no el "+" del teléfono.
  const { phone: rawPhone } = await props.params;
  const phone = decodeURIComponent(rawPhone);

  const citas = (await sql`
    select a.id, a.starts_at, a.status, a.customer_name, s.name as service_name, st.name as staff_name,
           sale.total_cents
      from appointments a
      join services s on s.id = a.service_id
      join staff st on st.id = a.staff_id
      left join sales sale on sale.appointment_id = a.id
     where a.business_id = ${business.id} and a.customer_phone = ${phone}
     order by a.starts_at desc
  `) as Cita[];

  if (citas.length === 0) notFound();

  const nombre = citas[0].customer_name;
  const gastoTotal = citas.reduce((n, c) => n + (c.total_cents ?? 0), 0);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('es-MX', {
      timeZone: business.timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));

  return (
    <main className="mt-6 space-y-4">
      <Link href="/panel/clientes" className="inline-flex min-h-11 cursor-pointer items-center text-sm text-accent-700 underline underline-offset-2">
        ← Todas las clientas
      </Link>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl text-ink">{nombre}</p>
            <p className="text-sm text-ink-muted">{citas.length} visita{citas.length === 1 ? '' : 's'}</p>
            <a
              href={`https://wa.me/${phone.replace('+', '')}`}
              className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-accent-700 transition-colors duration-200 hover:text-accent-600"
            >
              <MessageCircle className="h-4 w-4" />
              {phone}
            </a>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl text-accent-700">{money(gastoTotal)}</p>
            <p className="text-sm text-ink-muted">gastado en total</p>
          </div>
        </div>
      </Card>

      <Card title="Historial">
        <ul className="divide-y divide-blush-100 text-sm">
          {citas.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-ink">{c.service_name} · {c.staff_name}</p>
                <p className="text-xs text-ink-muted">
                  {fmt(c.starts_at)} · {STATUS_LABEL[c.status] ?? c.status}
                </p>
              </div>
              {c.total_cents != null && (
                <span className="shrink-0 tabular-nums text-ink">{money(c.total_cents)}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
