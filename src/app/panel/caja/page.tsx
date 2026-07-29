import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { todayIn, addDays, isDate } from '@/lib/dates';
import { sellProduct, addCashMovement } from '../admin';
import { Card, Field, Select, Input, Button, Guardado } from '@/components/panel-ui';
import { ChevronLeft, ChevronRight } from '@/components/icons';

type Venta = {
  id: string; created_at: string; description: string; qty: number;
  payment_method: string; total_cents: number; commission_cents: number; staff_name: string | null;
};

type ProductOption = { id: string; name: string; price_cents: number };
type Movimiento = { type: string; amount_cents: number };

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
};

const MOVEMENT_LABEL: Record<string, string> = {
  apertura: 'Fondo inicial', retiro: 'Retiro', deposito: 'Depósito', cierre: 'Conteo final',
};

const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export default async function Caja(props: PageProps<'/panel/caja'>) {
  const business = await requireBusiness();
  const q = await props.searchParams;
  const date = typeof q.date === 'string' && isDate(q.date) ? q.date : todayIn(business.timezone);
  const today = todayIn(business.timezone);

  // Rango: dos fechas en la URL en vez de una. Sin esto, pagar comisiones
  // quincenales o ver cuánto se vendió en la semana obligaba a sumar día
  // por día a mano.
  const rangeFrom = typeof q.from === 'string' && isDate(q.from) ? q.from : null;
  const rangeTo = typeof q.to === 'string' && isDate(q.to) ? q.to : null;
  const isRange = !!(rangeFrom && rangeTo && rangeFrom <= rangeTo);
  const desde = isRange ? rangeFrom! : date;
  const hasta = isRange ? rangeTo! : date;

  const ventas = (await sql`
    select s.id, s.created_at, s.description, s.qty, s.payment_method, s.total_cents,
           s.commission_cents, st.name as staff_name
      from sales s
      left join staff st on st.id = s.staff_id
     where s.business_id = ${business.id}
       and s.created_at >= (${desde}::timestamp at time zone ${business.timezone})
       and s.created_at <  ((${hasta}::date + 1)::timestamp at time zone ${business.timezone})
     order by s.created_at
  `) as Venta[];

  const products = (await sql`
    select id, name, price_cents from products
     where business_id = ${business.id} and active order by name
  `) as ProductOption[];

  const total = ventas.reduce((n, v) => n + v.total_cents, 0);

  const porMetodo = new Map<string, number>();
  for (const v of ventas) porMetodo.set(v.payment_method, (porMetodo.get(v.payment_method) ?? 0) + v.total_cents);

  const porBarbero = new Map<string, { total: number; comision: number }>();
  for (const v of ventas) {
    const key = v.staff_name ?? 'Venta de mostrador';
    const acc = porBarbero.get(key) ?? { total: 0, comision: 0 };
    acc.total += v.total_cents;
    acc.comision += v.commission_cents;
    porBarbero.set(key, acc);
  }
  const totalComisiones = ventas.reduce((n, v) => n + v.commission_cents, 0);

  // El arqueo solo tiene sentido para un día concreto: "esperado vs contado"
  // de un rango de dos semanas no significa nada, cada día se cierra aparte.
  const movimientos = !isRange
    ? ((await sql`
        select type, amount_cents from cash_movements
         where business_id = ${business.id}
           and created_at >= (${date}::timestamp at time zone ${business.timezone})
           and created_at <  ((${date}::date + 1)::timestamp at time zone ${business.timezone})
         order by created_at
      `) as Movimiento[])
    : [];
  const sumaTipo = (t: string) => movimientos.filter((m) => m.type === t).reduce((n, m) => n + m.amount_cents, 0);
  const apertura = sumaTipo('apertura');
  const retiros = sumaTipo('retiro');
  const depositos = sumaTipo('deposito');
  const cierreMovs = movimientos.filter((m) => m.type === 'cierre');
  const contado = cierreMovs.length > 0 ? cierreMovs[cierreMovs.length - 1].amount_cents : null;
  const ventasEfectivo = porMetodo.get('efectivo') ?? 0;
  const esperado = apertura + ventasEfectivo + depositos - retiros;
  const diferencia = contado != null ? contado - esperado : null;

  const fmtCorta = (d: string) =>
    new Intl.DateTimeFormat('es-MX', { timeZone: business.timezone, day: 'numeric', month: 'short' })
      .format(new Date(`${d}T12:00:00Z`));

  const header = isRange
    ? `${fmtCorta(desde)} — ${fmtCorta(hasta)}`
    : new Intl.DateTimeFormat('es-MX', {
        timeZone: business.timezone, weekday: 'long', day: 'numeric', month: 'long',
      }).format(new Date(`${date}T12:00:00Z`));

  const hhmm = (iso: string) =>
    new Intl.DateTimeFormat('es-MX', {
      timeZone: business.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));

  const exportUrl = `/api/caja/export?from=${desde}&to=${hasta}`;

  return (
    <main className="mt-6 space-y-4">
      <Guardado visible={q.ok === '1'} />

      <nav className="flex items-center justify-between gap-3">
        {isRange ? (
          <div className="h-11 w-11 shrink-0" aria-hidden />
        ) : (
          <Link
            href={`/panel/caja?date=${addDays(date, -1)}`}
            aria-label="Día anterior"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-blush-200 bg-surface text-ink-soft shadow-soft transition-colors duration-200 hover:border-accent-400 hover:bg-blush-50"
          >
            <ChevronLeft />
          </Link>
        )}
        <div className="min-w-0 text-center">
          <p className="truncate font-display text-lg text-ink first-letter:uppercase">{header}</p>
          {isRange ? (
            <Link
              href="/panel/caja"
              className="inline-flex min-h-11 cursor-pointer items-center text-xs text-accent-700 underline underline-offset-2"
            >
              Ver un solo día
            </Link>
          ) : date !== today ? (
            <Link
              href="/panel/caja"
              className="inline-flex min-h-11 cursor-pointer items-center text-xs text-accent-700 underline underline-offset-2"
            >
              Ir a hoy
            </Link>
          ) : null}
        </div>
        {isRange ? (
          <div className="h-11 w-11 shrink-0" aria-hidden />
        ) : (
          <Link
            href={`/panel/caja?date=${addDays(date, 1)}`}
            aria-label="Día siguiente"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-blush-200 bg-surface text-ink-soft shadow-soft transition-colors duration-200 hover:border-accent-400 hover:bg-blush-50"
          >
            <ChevronRight />
          </Link>
        )}
      </nav>

      <Card>
        <form className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Field label="Desde">
              <Input name="from" type="date" defaultValue={desde} required />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Hasta">
              <Input name="to" type="date" defaultValue={hasta} required />
            </Field>
          </div>
          <Button type="submit" tone="ghost">Ver rango</Button>
          <a
            href={exportUrl}
            className="ml-auto inline-flex min-h-11 cursor-pointer items-center text-sm text-accent-700 underline underline-offset-2"
          >
            Exportar CSV
          </a>
        </form>
      </Card>

      {/* Desde tablet horizontal: corte + especialista a la izquierda,
          vender producto + movimientos a la derecha — así se ve el corte
          completo mientras se registra una venta, sin scroll. */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-4">
          <Card title={isRange ? 'Corte del rango' : 'Corte del día'}>
            <p className="font-display text-3xl text-accent-700">{money(total)}</p>
            {ventas.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                Sin cobros {isRange ? 'en este rango' : 'este día'}.
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                {[...porMetodo].map(([m, c]) => (
                  <li key={m} className="flex justify-between">
                    <span>{METHOD_LABEL[m] ?? m}</span>
                    <span className="tabular-nums">{money(c)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {porBarbero.size > 0 && (
            <Card
              title="Por especialista"
              hint={totalComisiones > 0 ? `Comisión total: ${money(totalComisiones)}` : undefined}
            >
              <ul className="space-y-2 text-sm text-ink-soft">
                {[...porBarbero].map(([n, v]) => (
                  <li key={n} className="flex justify-between">
                    <span>{n}</span>
                    <span className="text-right">
                      <span className="tabular-nums text-ink">{money(v.total)}</span>
                      {v.comision > 0 && (
                        <span className="ml-2 tabular-nums text-xs text-ink-muted">
                          (comisión {money(v.comision)})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {!isRange && (
            <Card title="Arqueo de caja">
              <ul className="space-y-1 text-sm text-ink-soft">
                <li className="flex justify-between">
                  <span>Fondo inicial</span>
                  <span className="tabular-nums">{money(apertura)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Ventas en efectivo</span>
                  <span className="tabular-nums">{money(ventasEfectivo)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Depósitos</span>
                  <span className="tabular-nums">{money(depositos)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Retiros</span>
                  <span className="tabular-nums">−{money(retiros)}</span>
                </li>
                <li className="flex justify-between border-t border-blush-100 pt-1.5 font-medium text-ink">
                  <span>Esperado en caja</span>
                  <span className="tabular-nums">{money(esperado)}</span>
                </li>
                {contado != null && (
                  <>
                    <li className="flex justify-between">
                      <span>Contado</span>
                      <span className="tabular-nums">{money(contado)}</span>
                    </li>
                    <li className={`flex justify-between font-medium ${
                      diferencia === 0 ? 'text-success-text' : 'text-danger-text'
                    }`}>
                      <span>Diferencia</span>
                      <span className="tabular-nums">
                        {diferencia! > 0 ? '+' : ''}{money(diferencia!)}
                      </span>
                    </li>
                  </>
                )}
              </ul>

              <form action={addCashMovement} className="mt-4 space-y-3 border-t border-blush-100 pt-4">
                <input type="hidden" name="date" value={date} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Movimiento">
                    <Select name="type" defaultValue="retiro">
                      <option value="apertura">Fondo inicial</option>
                      <option value="retiro">Retiro</option>
                      <option value="deposito">Depósito</option>
                      <option value="cierre">Conteo final</option>
                    </Select>
                  </Field>
                  <Field label="Monto" hint="MXN">
                    <Input name="amount" type="number" inputMode="decimal" min={0} step="1" required />
                  </Field>
                </div>
                <Field label="Nota" hint="opcional">
                  <Input name="note" placeholder="Cambio para el día siguiente" maxLength={120} />
                </Field>
                <Button type="submit" tone="ghost">Registrar movimiento</Button>
              </form>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card
            title="Vender producto"
            hint={products.length === 0 ? 'Aún no tienes productos activos. Agrega uno en Inventario.' : undefined}
          >
            {products.length > 0 && (
              <form action={sellProduct} className="space-y-4">
                <input type="hidden" name="date" value={date} />
                <Field label="Producto">
                  <Select name="product_id" required defaultValue="">
                    <option value="" disabled>Elige un producto</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} · {money(p.price_cents)}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cantidad">
                    <Input name="qty" type="number" inputMode="numeric" min={1} step={1} defaultValue={1} required />
                  </Field>
                  <Field label="Método de pago">
                    <Select name="payment_method" defaultValue="efectivo">
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                    </Select>
                  </Field>
                </div>
                <Button type="submit">Registrar venta</Button>
              </form>
            )}
          </Card>

          {ventas.length > 0 && (
            <Card title="Movimientos">
              <ul className="divide-y divide-blush-100 text-sm">
                {ventas.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {v.description}{v.qty > 1 ? ` ×${v.qty}` : ''}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {hhmm(v.created_at)} · {METHOD_LABEL[v.payment_method] ?? v.payment_method}
                        {v.staff_name ? ` · ${v.staff_name}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-ink">{money(v.total_cents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
