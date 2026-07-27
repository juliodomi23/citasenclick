import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { saveService, toggleService } from '../admin';
import { Card, Field, Input, Button, Empty, Guardado } from '@/components/panel-ui';

type Service = {
  id: string; name: string; duration_minutes: number;
  buffer_after_minutes: number; price_cents: number; active: boolean;
};

export default async function Servicios(props: PageProps<'/panel/servicios'>) {
  const business = await requireBusiness();
  const q = await props.searchParams;

  const services = (await sql`
    select id, name, duration_minutes, buffer_after_minutes, price_cents, active
      from services where business_id = ${business.id}
     order by active desc, name
  `) as Service[];

  return (
    <main className="mt-6 space-y-4">
      <Guardado visible={q.ok === '1'} />
      {services.length === 0 && (
        <Empty>Aún no tienes servicios. Agrega el primero abajo.</Empty>
      )}

      {services.map((s) => (
        <Card key={s.id}>
          <form action={saveService} className="space-y-4">
            <input type="hidden" name="id" value={s.id} />

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <Field label="Nombre">
                  <Input name="name" defaultValue={s.name} required maxLength={80} />
                </Field>
              </div>
              {!s.active && (
                <span className="mt-7 shrink-0 rounded-full border border-blush-200 bg-blush-50 px-2.5 py-1 text-xs text-ink-muted">
                  Oculto
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Duración" hint="min">
                <Input name="duration_minutes" type="number" inputMode="numeric"
                  min={5} max={720} step={5} defaultValue={s.duration_minutes} required />
              </Field>
              <Field label="Limpieza" hint="min">
                <Input name="buffer_after_minutes" type="number" inputMode="numeric"
                  min={0} max={240} step={5} defaultValue={s.buffer_after_minutes} />
              </Field>
              <Field label="Precio" hint="MXN">
                <Input name="price" type="number" inputMode="decimal"
                  min={0} step="1" defaultValue={(s.price_cents / 100).toFixed(0)} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" aria-label={`Guardar ${s.name}`}>Guardar</Button>
              <Button
                type="submit"
                tone={s.active ? 'danger' : 'ghost'}
                formAction={toggleService}
                aria-label={`${s.active ? 'Ocultar' : 'Volver a mostrar'} ${s.name}`}
              >
                {s.active ? 'Ocultar del sitio' : 'Volver a mostrar'}
              </Button>
            </div>
          </form>
        </Card>
      ))}

      <Card
        title="Agregar servicio"
        hint="La limpieza es el tiempo que necesitas entre una clienta y la siguiente."
      >
        <form action={saveService} className="space-y-4">
          <Field label="Nombre">
            <Input name="name" required maxLength={80} placeholder="Manicure con gelish" />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Duración" hint="min">
              <Input name="duration_minutes" type="number" inputMode="numeric"
                min={5} max={720} step={5} defaultValue={30} required />
            </Field>
            <Field label="Limpieza" hint="min">
              <Input name="buffer_after_minutes" type="number" inputMode="numeric"
                min={0} max={240} step={5} defaultValue={5} />
            </Field>
            <Field label="Precio" hint="MXN">
              <Input name="price" type="number" inputMode="decimal" min={0} step="1" defaultValue={0} />
            </Field>
          </div>
          <Button type="submit">Agregar servicio</Button>
        </form>
      </Card>

      <p className="px-1 text-sm text-ink-muted">
        Los servicios no se borran: se ocultan. Así las citas viejas conservan su
        historial.
      </p>
    </main>
  );
}
