import { requireBusiness } from '@/lib/auth';
import { TIMEZONES } from '@/lib/panel';
import { saveSettings } from '../admin';
import { Card, Field, Input, Select, Button, Guardado } from '@/components/panel-ui';

const GRANULARITIES = [5, 10, 15, 20, 30, 60];

export default async function Ajustes(props: PageProps<'/panel/ajustes'>) {
  const b = await requireBusiness();
  const q = await props.searchParams;

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const publicUrl = `${base.replace(/\/$/, '')}/${b.slug}`;

  return (
    <main className="mt-6 space-y-4">
      <Guardado visible={q.ok === '1'} />
      <Card title="Tu enlace" hint="Este es el que compartes en Instagram o en tu estado de WhatsApp.">
        <p className="break-all rounded-xl bg-blush-50 px-4 py-3 font-medium text-accent-700">
          {publicUrl}
        </p>
      </Card>

      <form action={saveSettings} className="space-y-4">

        <Card title="Datos del negocio">
          <div className="space-y-4">
            <Field label="Nombre">
              <Input name="name" defaultValue={b.name} required maxLength={80} />
            </Field>

            <Field label="WhatsApp del negocio" hint="10 dígitos, opcional">
              <Input
                name="whatsapp_phone"
                type="tel"
                inputMode="numeric"
                defaultValue={b.whatsapp_phone?.replace('+52', '') ?? ''}
                placeholder="961 123 4567"
              />
            </Field>

            <Field label="Zona horaria">
              <Select name="timezone" defaultValue={b.timezone}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.split('/')[1].replace('_', ' ')}</option>
                ))}
              </Select>
            </Field>

            <Field label="Link de reseña" hint="Google, Facebook... opcional">
              <Input
                name="review_url"
                type="url"
                defaultValue={b.review_url ?? ''}
                placeholder="https://g.page/r/tu-negocio/review"
              />
            </Field>
            <p className="text-sm text-ink-muted">
              Si lo llenas, a cada cliente le llega un WhatsApp pidiendo reseña
              unas horas después de atenderlo. Vacío = no se pide.
            </p>
          </div>
        </Card>

        <Card title="Reglas de agendamiento">
          <div className="space-y-4">
            <Field label="Con cuánta anticipación pueden agendar" hint="días">
              <Input
                name="booking_window_days" type="number" inputMode="numeric"
                min={1} max={180} defaultValue={b.booking_window_days}
              />
            </Field>

            <Field label="Tiempo mínimo antes de la cita" hint="minutos">
              <Input
                name="min_notice_minutes" type="number" inputMode="numeric" step={15}
                min={0} max={10080} defaultValue={b.min_notice_minutes}
              />
            </Field>

            <Field label="Cada cuánto empieza un horario" hint="minutos">
              <Select name="slot_granularity_minutes" defaultValue={String(b.slot_granularity_minutes)}>
                {GRANULARITIES.map((g) => (
                  <option key={g} value={g}>Cada {g} minutos</option>
                ))}
              </Select>
            </Field>

            <p className="text-sm text-ink-muted">
              El tiempo mínimo también es la ventana para que una clienta cancele
              sola. Después de eso solo puede avisarte por WhatsApp.
            </p>
            <p className="text-sm text-ink-muted">
              &quot;Cada cuánto empieza un horario&quot; es aparte de la duración de
              cada servicio: aplica a todo el negocio y define en qué minutos se
              ofrecen horas de inicio (ej. cada 15 → 9:00, 9:15, 9:30…). Si
              quieres que todo empiece siempre en punto aunque un corte dure
              menos de una hora, pon 60.
            </p>
          </div>
        </Card>

        <Button type="submit">Guardar cambios</Button>
      </form>

      <Card title="Acceso al panel">
        <p className="text-sm text-ink-soft">
          Entras con un enlace que te mandamos por WhatsApp, sin contraseña. Si
          pierdes el celular, avísanos para cerrar tus sesiones.
        </p>
      </Card>
    </main>
  );
}
