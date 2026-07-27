import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { DAYS, hhmm } from '@/lib/panel';
import { todayIn } from '@/lib/dates';
import { addScheduleRule, deleteScheduleRule, copyDayToAll, addOverride, deleteOverride } from '../admin';
import { Card, Field, Input, Button, Empty, Guardado } from '@/components/panel-ui';

type Staff = { id: string; name: string };
type Rule = { id: string; weekday: number; start_time: string; end_time: string };
type Override = {
  id: string; date: string; start_time: string | null; end_time: string | null; reason: string | null;
};

export default async function Horarios(props: PageProps<'/panel/horarios'>) {
  const q = await props.searchParams;
  const business = await requireBusiness();

  const staff = (await sql`
    select id, name from staff where business_id = ${business.id} and active order by name
  `) as Staff[];

  if (staff.length === 0) {
    return (
      <main className="mt-6">
        <Empty>
          Primero da de alta a tu equipo en la pestaña Equipo. Los horarios se
          definen por especialista.
        </Empty>
      </main>
    );
  }

  const wanted = typeof q.staff === 'string' ? q.staff : null;
  const current = staff.find((s) => s.id === wanted) ?? staff[0];

  const rules = (await sql`
    select id, weekday, start_time, end_time from schedule_rules
     where staff_id = ${current.id} order by weekday, start_time
  `) as Rule[];

  const overrides = (await sql`
    select id, date::text, start_time, end_time, reason from schedule_overrides
     where staff_id = ${current.id} and date >= current_date
     order by date
  `) as Override[];

  const byDay = (w: number) => rules.filter((r) => r.weekday === w);
  const today = todayIn(business.timezone);

  return (
    <main className="mt-6 space-y-4">
      <Guardado visible={q.ok === '1'} />
      {staff.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2">
            {staff.map((s) => (
              <Link
                key={s.id}
                href={`/panel/horarios?staff=${s.id}`}
                aria-current={s.id === current.id ? 'page' : undefined}
                className={`flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-xl border px-4 text-sm transition-colors duration-200 ${
                  s.id === current.id
                    ? 'border-accent-600 bg-accent-600 font-medium text-white'
                    : 'border-blush-200 bg-white text-ink-soft hover:bg-blush-50'
                }`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Card
        title={`Horario semanal de ${current.name}`}
        hint="Varios rangos el mismo día = turno partido (9 a 14 y 16 a 20)."
      >
        {/*
          Cada día se colapsa a una línea. Antes los 7 días venían abiertos con
          su formulario: 26 formularios y 3.76 pantallas de scroll en celular
          para cambiar un jueves.
          ponytail: <details> nativo, cero JavaScript. El día de hoy viene
          abierto, que es el que se toca el 90% de las veces.
        */}
        <div className="-my-2">
          {DAYS.map((label, weekday) => {
            const dayRules = byDay(weekday);
            const resumen = dayRules.length
              ? dayRules.map((r) => `${hhmm(r.start_time)}–${hhmm(r.end_time)}`).join(', ')
              : 'Cerrado';

            return (
              <details
                key={label}
                open={weekday === new Date(`${today}T12:00:00Z`).getUTCDay()}
                className="border-b border-blush-100 last:border-0"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2">
                  <span className="font-medium text-ink">{label}</span>
                  <span className={`text-sm tabular-nums ${dayRules.length ? 'text-ink-soft' : 'text-ink-muted'}`}>
                    {resumen}
                  </span>
                </summary>

                <div className="pb-4">
                  {dayRules.length > 0 && (
                    <ul className="space-y-2">
                      {dayRules.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-blush-50 px-3 py-2"
                        >
                          <span className="tabular-nums text-ink">
                            {hhmm(r.start_time)} — {hhmm(r.end_time)}
                          </span>
                          <form action={deleteScheduleRule}>
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              aria-label={`Quitar el rango de ${hhmm(r.start_time)} a ${hhmm(r.end_time)} del ${label}`}
                              className="min-h-11 cursor-pointer px-2 text-sm text-red-700 transition-colors duration-200 hover:text-red-800"
                            >
                              Quitar
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Los dos inputs lado a lado suman 378px y en el Card solo
                      hay 303px: se apilan en rejilla y el botón toma su fila. */}
                  <form action={addScheduleRule} className="mt-2 space-y-2">
                    <input type="hidden" name="staff_id" value={current.id} />
                    <input type="hidden" name="weekday" value={weekday} />
                    {/* <input type="time"> nativo: el teclado del celular ya sabe
                        pedir una hora, no hace falta ninguna librería. */}
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        name="start_time" type="time" required defaultValue="09:00"
                        aria-label={`Hora de apertura del ${label}`}
                      />
                      <Input
                        name="end_time" type="time" required defaultValue="14:00"
                        aria-label={`Hora de cierre del ${label}`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" tone="ghost">Agregar horario</Button>
                      {dayRules.length > 0 && (
                        <Button
                          type="submit"
                          tone="ghost"
                          formAction={copyDayToAll}
                          aria-label={`Copiar el horario del ${label} a todos los días de la semana`}
                        >
                          Copiar a todos los días
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </Card>

      <Card
        title="Días especiales"
        hint="Vacaciones, días festivos o un día que entras más tarde. Lo que pongas aquí gana sobre el horario semanal."
      >
        {overrides.length === 0 ? (
          <Empty>Sin días especiales próximos.</Empty>
        ) : (
          <ul className="space-y-2">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-blush-50 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-ink">{o.date}</span>
                  <span className="text-ink-muted">
                    {' · '}
                    {o.start_time && o.end_time
                      ? `${hhmm(o.start_time)} — ${hhmm(o.end_time)}`
                      : 'cerrado todo el día'}
                    {o.reason && ` · ${o.reason}`}
                  </span>
                </span>
                <form action={deleteOverride}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="min-h-11 cursor-pointer px-2 text-red-700 transition-colors duration-200 hover:text-red-800">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addOverride} className="mt-4 space-y-3 border-t border-blush-100 pt-4">
          <input type="hidden" name="staff_id" value={current.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Día">
              <Input name="date" type="date" required min={today} />
            </Field>
            <Field label="Motivo" hint="opcional">
              <Input name="reason" maxLength={80} placeholder="Vacaciones" />
            </Field>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
            <input type="checkbox" name="closed" className="h-4 w-4 accent-accent-600" />
            Cerrado todo el día
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Abre" hint="si no cierras todo el día">
              <Input name="start_time" type="time" defaultValue="09:00" />
            </Field>
            <Field label="Cierra">
              <Input name="end_time" type="time" defaultValue="14:00" />
            </Field>
          </div>

          <Button type="submit">Agregar día especial</Button>
        </form>
      </Card>
    </main>
  );
}
