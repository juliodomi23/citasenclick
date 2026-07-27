import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { cancelAppointment } from './actions';
import { Check, Calendar, Clock, MessageCircle, AlertTriangle } from '@/components/icons';

type Row = {
  id: string; status: string; starts_at: string; timezone: string;
  business_name: string; whatsapp_phone: string | null;
  service_name: string; staff_name: string; customer_name: string;
  min_notice_minutes: number;
};

export default async function Page(props: PageProps<'/c/[token]'>) {
  const { token } = await props.params;
  const rows = (await sql`
    select a.id, a.status, a.starts_at, a.customer_name,
           b.timezone, b.name as business_name, b.whatsapp_phone, b.min_notice_minutes,
           s.name as service_name, st.name as staff_name
      from appointments a
      join businesses b on b.id = a.business_id
      join services s on s.id = a.service_id
      join staff st on st.id = a.staff_id
     where a.manage_token = ${token}
  `) as Row[];

  const appt = rows[0];
  if (!appt) notFound();

  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-MX', { timeZone: appt.timezone, ...opts }).format(
      new Date(appt.starts_at)
    );

  const cancelled = appt.status === 'cancelled';

  // Después de la ventana mínima ya no se cancela solo: se manda al WhatsApp del negocio.
  const cancellable =
    appt.status === 'confirmed' &&
    new Date(appt.starts_at).getTime() - Date.now() > appt.min_notice_minutes * 60_000;

  const wa = appt.whatsapp_phone?.replace('+', '');

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
      <header className="text-center">
        <h1 className="font-display text-2xl text-ink">{appt.business_name}</h1>
        <span className="mx-auto mt-4 block h-px w-12 bg-accent-200" />
      </header>

      <section className="animate-rise mt-6 overflow-hidden rounded-2xl bg-white shadow-soft-lg">
        <div
          className={`flex items-center gap-3 px-6 py-5 text-white ${
            cancelled ? 'bg-ink-muted' : 'bg-accent-600'
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            {cancelled ? <AlertTriangle className="h-5 w-5" /> : <Check className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-display text-lg">
              {cancelled ? 'Cita cancelada' : 'Tu cita está confirmada'}
            </p>
            <p className="text-sm text-white">A nombre de {appt.customer_name}</p>
          </div>
        </div>

        <dl className="divide-y divide-blush-100 px-6 py-1 text-sm">
          <Row
            icon={<Calendar className="h-4 w-4" />}
            label="Día"
            value={fmt({ weekday: 'long', day: 'numeric', month: 'long' })}
          />
          <Row
            icon={<Clock className="h-4 w-4" />}
            label="Hora"
            value={`${fmt({ hour: '2-digit', minute: '2-digit', hour12: false })} hrs`}
          />
          <Row label="Servicio" value={appt.service_name} />
          <Row label="Con" value={appt.staff_name} />
        </dl>

        <div className="px-6 pb-6 pt-4">
          {cancelled ? (
            <p className="text-sm text-ink-muted">
              Si quieres reagendar, vuelve a la página del negocio y elige un nuevo horario.
            </p>
          ) : cancellable ? (
            <div className="space-y-3">
              <a
                href={`/c/${token}/ics`}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blush-50 px-4 text-sm font-medium text-accent-700 transition-colors duration-200 hover:bg-blush-100"
              >
                <Calendar className="h-4 w-4" />
                Agregar a mi calendario
              </a>
              {/*
                Para la clienta cancelar no tiene "deshacer": un toque perdía la
                cita para siempre. Dos pasos con <details> nativo, sin JS.
              */}
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-red-300 bg-white px-4 text-sm font-medium text-red-700 transition-colors duration-200 hover:bg-red-50 group-open:hidden">
                  Cancelar mi cita
                </summary>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-900">
                    ¿Seguro? Se libera tu horario y alguien más puede tomarlo.
                  </p>
                  <form action={cancelAppointment} className="mt-3">
                    <input type="hidden" name="token" value={token} />
                    <button className="min-h-11 w-full cursor-pointer rounded-xl bg-red-700 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-800">
                      Sí, cancelar mi cita
                    </button>
                  </form>
                </div>
              </details>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                Ya estamos muy cerca de tu cita para cancelarla en línea.
              </p>
              {wa && (
                <a
                  href={`https://wa.me/${wa}`}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blush-50 px-4 text-sm font-medium text-accent-700 transition-colors duration-200 hover:bg-blush-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  Avísale al negocio por WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-ink-muted">
        {icon && <span className="text-accent-500">{icon}</span>}
        {label}
      </dt>
      <dd className="text-right font-medium first-letter:uppercase">{value}</dd>
    </div>
  );
}
