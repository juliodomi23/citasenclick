import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { todayIn, addDays, startOfWeek, civilDate, isDate } from '@/lib/dates';
import { setStatus } from './actions';
import { ChevronLeft, ChevronRight, MessageCircle, AlertTriangle, Calendar } from '@/components/icons';

type Biz = { id: string; name: string; slug: string; timezone: string };

type Appt = {
  id: string; starts_at: string; ends_at: string; status: string;
  customer_name: string; customer_phone: string; notes: string | null;
  service_name: string; staff_name: string;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  no_show: 'No llegó',
  completed: 'Atendida',
};

// El color no es el único indicador: cada estado lleva también su etiqueta.
const STATUS_CHIP: Record<string, string> = {
  cancelled: 'bg-danger-bg text-danger-text border-danger-border',
  no_show: 'bg-warning-bg text-warning-text border-warning-border',
  completed: 'bg-success-bg text-success-text border-success-border',
};

export default async function Panel(props: PageProps<'/panel'>) {
  const q = await props.searchParams;
  const biz = await requireBusiness();

  const week = q.view === 'week';
  const date = typeof q.date === 'string' && isDate(q.date) ? q.date : todayIn(biz.timezone);

  // Una sola query para ambas vistas: cambia el rango, no el código.
  const from = week ? startOfWeek(date) : date;
  const days = Array.from({ length: week ? 7 : 1 }, (_, i) => addDays(from, i));
  const to = addDays(from, days.length);

  const appts = (await sql`
    select a.id, a.starts_at, a.ends_at, a.status, a.customer_name, a.customer_phone,
           a.notes, s.name as service_name, st.name as staff_name
      from appointments a
      join services s on s.id = a.service_id
      join staff st on st.id = a.staff_id
     where a.business_id = ${biz.id}
       and a.starts_at >= (${from}::timestamp at time zone ${biz.timezone})
       and a.starts_at <  (${to}::timestamp at time zone ${biz.timezone})
     order by a.starts_at, st.name
  `) as Appt[];

  // El agrupado usa la fecha civil del negocio, no la del servidor.
  const byDay = new Map<string, Appt[]>(days.map((d) => [d, []]));
  for (const a of appts) byDay.get(civilDate(a.starts_at, biz.timezone))?.push(a);

  const today = todayIn(biz.timezone);
  const activas = appts.filter((a) => a.status === 'confirmed').length;
  const nav = { date, view: week ? 'week' : 'day' };

  const header = week
    ? `${fmtDay(from, biz.timezone)} — ${fmtDay(addDays(from, 6), biz.timezone)}`
    : new Intl.DateTimeFormat('es-MX', {
        timeZone: biz.timezone, weekday: 'long', day: 'numeric', month: 'long',
      }).format(new Date(`${date}T12:00:00Z`));

  return (
    <main>
      <div className="mt-5 inline-flex rounded-xl border border-blush-200 bg-surface p-1 shadow-soft">
        <ViewTab date={date} view="day" active={!week} label="Día" />
        <ViewTab date={date} view="week" active={week} label="Semana" />
      </div>

      <nav className="mt-4 flex items-center justify-between gap-3">
        <StepLink {...nav} to={addDays(date, week ? -7 : -1)} dir="prev"
          label={week ? 'Semana anterior' : 'Día anterior'} />
        <div className="min-w-0 text-center">
          <p className="truncate font-display text-lg text-ink first-letter:uppercase">{header}</p>
          {!days.includes(today) && (
            <Link
              href={`/panel?view=${nav.view}`}
              className="inline-flex min-h-11 cursor-pointer items-center text-xs text-accent-700 underline underline-offset-2"
            >
              {week ? 'Ir a esta semana' : 'Ir a hoy'}
            </Link>
          )}
        </div>
        <StepLink {...nav} to={addDays(date, week ? 7 : 1)} dir="next"
          label={week ? 'Semana siguiente' : 'Día siguiente'} />
      </nav>

      {q.error === 'ocupado' && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-bg p-3 text-sm text-warning-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          No se pudo reactivar: ese horario ya lo tomó otra cita.
        </p>
      )}

      <p className="mt-6 text-sm text-ink-muted">
        {activas === 0
          ? `Sin citas activas est${week ? 'a semana' : 'e día'}.`
          : `${activas} cita${activas === 1 ? '' : 's'} activa${activas === 1 ? '' : 's'}`}
      </p>

      <div className="mt-3 space-y-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          if (!week && list.length === 0) {
            return <Empty key={d} />;
          }
          return (
            <section key={d}>
              {week && (
                <h2 className="mb-2 flex items-baseline justify-between border-b border-blush-200 pb-1.5">
                  <span className={`font-display text-base first-letter:uppercase ${
                    d === today ? 'text-accent-700' : 'text-ink-soft'
                  }`}>
                    {fmtDay(d, biz.timezone)}{d === today && ' · hoy'}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {list.filter((a) => a.status === 'confirmed').length || '—'}
                  </span>
                </h2>
              )}
              {week && list.length === 0 && (
                <p className="py-1 text-sm text-ink-muted">Sin citas.</p>
              )}
              <ul className="space-y-3">
                {list.map((a) => (
                  <ApptCard key={a.id} appt={a} tz={biz.timezone} {...nav} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

const fmtDay = (date: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(/ de /g, ' ');

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-blush-200 bg-surface/60 px-6 py-10 text-center">
      <Calendar className="mx-auto h-6 w-6 text-accent-400" />
      <p className="mt-2 text-sm text-ink-muted">No hay citas este día.</p>
    </div>
  );
}

function ApptCard({
  appt: a, tz, date, view,
}: { appt: Appt; tz: string; date: string; view: string }) {
  const closed = a.status !== 'confirmed';
  const hhmm = (iso: string) =>
    new Intl.DateTimeFormat('es-MX', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));

  return (
    <li
      className={`overflow-hidden rounded-2xl border bg-surface shadow-soft ${
        closed ? 'border-blush-100' : 'border-blush-200'
      }`}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Franja de hora: ancla visual para escanear la agenda de un vistazo */}
        <div
          className={`shrink-0 rounded-xl px-3 py-2 text-center ${
            closed ? 'bg-blush-50 text-ink-muted' : 'bg-blush-100 text-accent-700'
          }`}
        >
          <span className="block font-display text-lg leading-none tabular-nums">
            {hhmm(a.starts_at)}
          </span>
          <span className="mt-1 block text-xs tabular-nums">{hhmm(a.ends_at)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className={`font-medium ${closed ? 'text-ink-muted line-through' : 'text-ink'}`}>
              {a.customer_name}
            </p>
            {closed && (
              <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CHIP[a.status] ?? ''}`}>
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
            )}
          </div>

          <p className="text-sm text-ink-muted">
            {a.service_name} · {a.staff_name}
          </p>

          <a
            href={`https://wa.me/${a.customer_phone.replace('+', '')}`}
            className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-accent-700 transition-colors duration-200 hover:text-accent-600"
          >
            <MessageCircle className="h-4 w-4" />
            {a.customer_phone}
          </a>

          {a.notes && (
            <p className="mt-1 rounded-lg bg-blush-50 px-3 py-2 text-sm italic text-ink-soft">
              “{a.notes}”
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-blush-100 bg-cream px-4 py-3">
        {closed ? (
          <StatusButton {...{ date, view }} id={a.id} status="confirmed" label="Reactivar" />
        ) : (
          <>
            <StatusButton {...{ date, view }} id={a.id} status="completed" label="Atendida" primary
              contexto={`la cita de ${a.customer_name} de las ${hhmm(a.starts_at)}`} />
            <StatusButton {...{ date, view }} id={a.id} status="no_show" label="No llegó"
              contexto={`la cita de ${a.customer_name} de las ${hhmm(a.starts_at)}`} />
            {/* Separado del resto: es el único que la clienta nota si se toca por error. */}
            <StatusButton {...{ date, view }} id={a.id} status="cancelled" label="Cancelar" danger
              className="ml-auto"
              contexto={`la cita de ${a.customer_name} de las ${hhmm(a.starts_at)}`} />
          </>
        )}
      </div>
    </li>
  );
}

function ViewTab({
  date, view, active, label,
}: { date: string; view: string; active: boolean; label: string }) {
  return (
    <Link
      href={`/panel?date=${date}&view=${view}`}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm transition-colors duration-200 ${
        active ? 'bg-accent-600 font-medium text-white' : 'text-ink-soft hover:bg-blush-50'
      }`}
    >
      {label}
    </Link>
  );
}

function StepLink({
  to, view, label, dir,
}: { date: string; to: string; view: string; label: string; dir: 'prev' | 'next' }) {
  return (
    <Link
      href={`/panel?date=${to}&view=${view}`}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-blush-200 bg-surface text-ink-soft shadow-soft transition-colors duration-200 hover:border-accent-400 hover:bg-blush-50"
    >
      {dir === 'prev' ? <ChevronLeft /> : <ChevronRight />}
    </Link>
  );
}

function StatusButton({
  id, date, view, status, label, danger, primary, contexto, className = '',
}: {
  id: string; date: string; view: string; status: string; label: string;
  danger?: boolean; primary?: boolean; contexto?: string; className?: string;
}) {
  // El fondo va en cada variante, nunca en la base: dos clases de background en
  // la misma cadena las resuelve el orden del CSS, no el de la cadena, y el
  // botón primario acababa en blanco sobre blanco.
  const tone = danger
    ? 'border-danger-border bg-surface text-danger-text hover:bg-danger-bg'
    : primary
      ? 'border-accent-600 bg-accent-600 text-white hover:bg-accent-700'
      : 'border-blush-200 bg-surface text-ink-soft hover:bg-blush-50';

  return (
    <form action={setStatus} className={className.includes("ml-auto") ? "ml-auto" : undefined}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="status" value={status} />
      <button
        aria-label={contexto ? `${label} — ${contexto}` : undefined}
        className={`min-h-11 cursor-pointer rounded-xl border px-4 text-sm font-medium transition-colors duration-200 ${tone} ${className}`}
      >
        {label}
      </button>
    </form>
  );
}
