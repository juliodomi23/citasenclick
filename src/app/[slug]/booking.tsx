'use client';

import { useEffect, useRef, useState } from 'react';
import { addDays, todayIn } from '@/lib/dates';
import { Check, Clock, Calendar, MessageCircle, AlertTriangle } from '@/components/icons';

export type Service = { id: string; name: string; duration_minutes: number; price_cents: number };
export type Staff = { id: string; name: string; service_ids: string[] };

/** "No tengo preferencia" viaja como un especialista más; el servidor resuelve quién. */
const ANY_STAFF = 'any';
const ANY: Staff = { id: ANY_STAFF, name: 'quien esté disponible', service_ids: [] };

type Props = {
  slug: string;
  timezone: string;
  bookingWindowDays: number;
  whatsappPhone: string | null;
  services: Service[];
  staff: Staff[];
};

// ponytail: Intl nativo en vez de luxon. El servidor hace la aritmética de
// zonas; aquí solo se formatea.
// El " de " de es-MX ("dom 26 de jul") parte el botón en dos líneas y descuadra
// la rejilla en celular. Se quita: "dom 26 jul" cabe en una línea.
const fmtDate = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(/ de /g, ' ');

const fmtTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(iso));

const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

/**
 * Etiqueta de zona horaria. Se usa el offset ("GMT-6") y no el nombre IANA:
 * un negocio de Tuxtla no quiere leer "Mexico City" en su propia página.
 */
const tzLabel = (tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value ?? '';

/** Los próximos N días en formato YYYY-MM-DD, empezando hoy en la zona del negocio. */
const upcomingDates = (tz: string, days: number) =>
  Array.from({ length: days }, (_, i) => addDays(todayIn(tz), i));

export function Booking({ slug, timezone, bookingWindowDays, whatsappPhone, services, staff }: Props) {
  const [service, setService] = useState<Service | null>(null);
  const [person, setPerson] = useState<Staff | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ manage_token: string; staff_name?: string } | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // Al confirmar, el árbol entero se reemplaza y el foco caería a <body>: quien
  // usa lector de pantalla no se enteraría de que la cita quedó agendada.
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  const dates = upcomingDates(timezone, Math.min(bookingWindowDays, 14));
  const eligibleStaff = service ? staff.filter((s) => s.service_ids.includes(service.id)) : [];

  // Un solo especialista no es una decisión: es un tap de más. La mitad de las
  // barberías y estéticas de Tuxtla son de una sola persona.
  useEffect(() => {
    if (service && !person && eligibleStaff.length === 1) setPerson(eligibleStaff[0]);
  }, [service, person, eligibleStaff]);

  useEffect(() => {
    if (!service || !person || !date) return;
    setSlots(null);
    setSlot(null);
    const params = new URLSearchParams({ slug, service: service.id, staff: person.id, date });
    fetch(`/api/availability?${params}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]));
  }, [slug, service, person, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug, service: service!.id, staff: person!.id, date, slot, name, phone, notes,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? 'Algo salió mal, intenta de nuevo');
      if (res.status === 409) setSlot(null);  // el slot se fue: obliga a reelegir
      return;
    }
    setDone(data);
  }

  if (done) {
    return (
      <section className="animate-rise mt-8 overflow-hidden rounded-2xl bg-white shadow-soft-lg">
        <div className="flex flex-col items-center gap-3 bg-accent-600 px-6 py-8 text-center text-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <Check className="h-7 w-7" />
          </span>
          <h2 ref={doneRef} tabIndex={-1} className="font-display text-2xl outline-none">
            ¡Tu cita está confirmada!
          </h2>
        </div>

        <dl className="divide-y divide-blush-100 px-6 py-2 text-sm">
          <Row label="Servicio" value={service!.name} />
          <Row label="Con" value={done.staff_name ?? person!.name} />
          <Row
            label="Cuándo"
            value={`${fmtDate(date!, timezone)} · ${fmtTime(slot!, timezone)} hrs`}
          />
        </dl>

        <div className="space-y-3 px-6 pb-6 pt-2">
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <MessageCircle className="h-4 w-4 shrink-0" />
            Te enviamos la confirmación por WhatsApp.
          </p>
          <a
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blush-50 px-4 text-sm font-medium text-accent-700 transition-colors duration-200 hover:bg-blush-100"
            href={`/c/${done.manage_token}/ics`}
          >
            <Calendar className="h-4 w-4" />
            Agregar a mi calendario
          </a>
          <a
            className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-blush-200 px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-blush-50"
            href={`/c/${done.manage_token}`}
          >
            Ver o cancelar mi cita
          </a>
        </div>
      </section>
    );
  }

  // Paso activo: el primero sin resolver. Los anteriores se colapsan a resumen
  // para que en celular el formulario quede a la vista sin scroll interminable.
  const step = !service ? 1 : !person ? 2 : !date ? 3 : !slot ? 4 : 5;

  return (
    <div className="mt-8 space-y-4">
      {/*
        Una sola región live montada siempre. Poner aria-live sobre el esqueleto
        no sirve: ese elemento se destruye justo cuando llegan los datos, y iOS
        no anuncia regiones que nacen con su contenido dentro.
      */}
      <p aria-live="polite" className="sr-only">
        {step === 4 &&
          (slots === null
            ? 'Buscando horarios disponibles'
            : slots.length === 0
              ? 'No hay horarios disponibles ese día'
              : `${slots.length} horarios disponibles`)}
      </p>

      <Progress step={step} />

      {service && (
        <Summary
          label="Servicio"
          value={`${service.name} · ${service.duration_minutes} min`}
          onEdit={() => { setService(null); setPerson(null); setDate(null); setSlot(null); }}
        />
      )}
      {step === 1 && (
        <Step n={1} title="Elige el servicio">
          <Options
            items={services.map((s) => ({
              key: s.id,
              label: s.name,
              hint: `${s.duration_minutes} min`,
              trailing: money(s.price_cents),
              onSelect: () => setService(s),
            }))}
          />
        </Step>
      )}

      {person && (
        <Summary
          label="Con"
          value={person.id === ANY_STAFF ? 'Quien esté disponible' : person.name}
          onEdit={() => { setPerson(null); setDate(null); setSlot(null); }}
        />
      )}
      {step === 2 && eligibleStaff.length === 0 && (
        <Step n={2} title="¿Con quién?">
          {/* Servicio dado de alta sin asignar a nadie. Sin esto la clienta ve
              un título y el vacío, y se va. */}
          <Rescate
            texto="Ese servicio no tiene a nadie asignado todavía."
            whatsappPhone={whatsappPhone}
          />
        </Step>
      )}
      {step === 2 && eligibleStaff.length > 0 && (
        <Step n={2} title="¿Con quién?">
          <Options
            items={[
              ...eligibleStaff.map((p) => ({
                key: p.id,
                label: p.name,
                onSelect: () => setPerson(p),
              })),
              // Va al final: quien sí tiene especialista de cabecera lo encuentra
              // primero, y esta opción abre más horarios a quien no.
              ...(eligibleStaff.length > 1
                ? [{
                    key: ANY_STAFF,
                    label: 'No tengo preferencia',
                    hint: 'más horarios disponibles',
                    onSelect: () => setPerson(ANY),
                  }]
                : []),
            ]}
          />
        </Step>
      )}

      {date && (
        <Summary
          label="Día"
          value={fmtDate(date, timezone)}
          onEdit={() => { setDate(null); setSlot(null); }}
        />
      )}
      {step === 3 && (
        <Step n={3} title="Elige el día">
          {/* Rejilla que fluye hacia abajo, no carrusel horizontal: en celular
              lo que se sale de la pantalla no se descubre. */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                className="min-h-11 cursor-pointer whitespace-nowrap rounded-xl border border-border-control bg-white px-2 text-sm text-ink shadow-soft transition-colors duration-200 first-letter:uppercase hover:border-accent-400 hover:bg-blush-50"
              >
                {fmtDate(d, timezone)}
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 4 && (
        <Step n={4} title="Elige la hora">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5" />
            Horario del negocio ({tzLabel(timezone)})
          </p>

          {slots === null && (
            <div className="grid grid-cols-4 gap-2">
              {/* Esqueleto: reserva el alto para que no salte el contenido */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-blush-100" />
              ))}
            </div>
          )}

          {slots?.length === 0 && (
            <Rescate
              texto="No hay horarios disponibles ese día. Prueba con otro."
              whatsappPhone={whatsappPhone}
            />
          )}

          {slots && slots.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className="min-h-11 cursor-pointer rounded-xl border border-border-control bg-white text-sm font-medium text-ink shadow-soft transition-colors duration-200 hover:border-accent-400 hover:bg-blush-50"
                >
                  {fmtTime(s, timezone)}
                </button>
              ))}
            </div>
          )}
        </Step>
      )}

      {slot && (
        <>
          <Summary
            label="Hora"
            value={`${fmtTime(slot, timezone)} hrs`}
            onEdit={() => setSlot(null)}
          />
          <form
            onSubmit={submit}
            className="animate-rise space-y-4 rounded-2xl bg-white p-5 shadow-soft-lg"
          >
            <h2 className="font-display text-xl">Tus datos</h2>

            <Field id="nombre" label="Nombre">
              <input
                id="nombre"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border-control bg-cream px-3 text-base text-ink placeholder:text-ink-muted"
                placeholder="Como te llamas"
              />
            </Field>

            <Field id="tel" label="WhatsApp" hint="10 dígitos">
              <input
                id="tel"
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border-control bg-cream px-3 text-base text-ink placeholder:text-ink-muted"
                placeholder="961 123 4567"
                aria-invalid={!!error}
                aria-describedby={error ? 'error-form' : undefined}
              />
            </Field>

            <Field id="notas" label="Notas" hint="opcional">
              <input
                id="notas"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border-control bg-cream px-3 text-base text-ink placeholder:text-ink-muted"
                placeholder="Algo que debamos saber"
              />
            </Field>

            {error && (
              <p
                id="error-form"
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button
              disabled={sending}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-accent-600 px-4 font-medium text-white shadow-soft transition-colors duration-200 hover:bg-accent-700 disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? 'Confirmando…' : 'Confirmar mi cita'}
            </button>

            <p className="text-center text-xs text-ink-muted">
              {fmtDate(date!, timezone)} · {fmtTime(slot, timezone)} hrs
            </p>
          </form>
        </>
      )}
    </div>
  );
}

function Progress({ step }: { step: number }) {
  const labels = ['Servicio', 'Especialista', 'Día', 'Hora'];
  return (
    <ol className="flex items-center gap-1.5" aria-hidden>
      {labels.map((label, i) => (
        <li key={label} className="flex-1">
          <span
            className={`block h-1 rounded-full transition-colors duration-300 ${
              i < step - 1 ? 'bg-accent-600' : i === step - 1 ? 'bg-accent-600' : 'bg-border-control'
            }`}
          />
        </li>
      ))}
    </ol>
  );
}

/** Callejón sin salida: siempre con una puerta al WhatsApp del negocio. */
function Rescate({ texto, whatsappPhone }: { texto: string; whatsappPhone: string | null }) {
  return (
    <div className="rounded-xl border border-blush-200 bg-white p-4 text-sm shadow-soft">
      <p className="flex items-start gap-2 text-ink-soft">
        <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
        {texto}
      </p>
      {whatsappPhone && (
        <a
          className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blush-50 px-4 text-sm font-medium text-accent-700 transition-colors duration-200 hover:bg-blush-100"
          href={`https://wa.me/${whatsappPhone.replace('+', '')}`}
        >
          <MessageCircle className="h-4 w-4" />
          Escríbeles por WhatsApp
        </a>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  // Al avanzar de paso, el bloque anterior se desmonta con el botón enfocado
  // dentro y el lector vuelve al inicio de la página. Se mueve el foco al
  // encabezado nuevo. En el paso 1 no, que es la carga: robaría el foco.
  useEffect(() => { if (n > 1) ref.current?.focus(); }, [n]);

  return (
    <section ref={ref} tabIndex={-1} className="animate-rise outline-none">
      <h2 className="mb-3 font-display text-xl text-ink">
        <span className="mr-2 text-sm font-sans text-ink-muted" aria-hidden>{n}.</span>
        <span className="sr-only">Paso {n} de 4. </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Paso ya resuelto: ocupa una línea y se puede volver a abrir. */
function Summary({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-blush-100 bg-white/70 px-4 py-2.5 shadow-soft">
      <Check className="h-4 w-4 shrink-0 text-accent-600" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="text-ink-muted">{label}: </span>
        <span className="font-medium first-letter:uppercase">{value}</span>
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-11 shrink-0 cursor-pointer px-1 text-sm font-medium text-accent-700 underline decoration-accent-200 underline-offset-2 transition-colors duration-200 hover:text-accent-600"
      >
        Cambiar
      </button>
    </div>
  );
}

function Field({
  id, label, hint, children,
}: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft">
        {label}
        {hint && <span className="ml-1.5 font-normal text-ink-muted">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium first-letter:uppercase">{value}</dd>
    </div>
  );
}

type Option = {
  key: string; label: string; hint?: string; trailing?: string; onSelect: () => void;
};

function Options({ items }: { items: Option[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={it.onSelect}
          className="group flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border-control bg-white px-4 py-3 text-left shadow-soft transition-colors duration-200 hover:border-accent-400 hover:bg-blush-50"
        >
          <span className="min-w-0">
            <span className="block font-medium text-ink">{it.label}</span>
            {it.hint && <span className="block text-sm text-ink-muted">{it.hint}</span>}
          </span>
          {it.trailing && (
            <span className="shrink-0 font-display text-lg text-accent-700">{it.trailing}</span>
          )}
        </button>
      ))}
    </div>
  );
}
