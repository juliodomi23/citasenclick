import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { saveStaff, toggleStaff, setStaffServices } from '../../admin';
import { Card, Field, Input, Button, Empty, Guardado } from '@/components/panel-ui';

type Staff = {
  id: string; name: string; active: boolean; service_ids: string[]; commission_pct: string;
};
type Service = { id: string; name: string; active: boolean };

export default async function Equipo(props: PageProps<'/panel/ajustes/equipo'>) {
  const business = await requireBusiness();
  const q = await props.searchParams;

  const services = (await sql`
    select id, name, active from services where business_id = ${business.id} order by name
  `) as Service[];

  const staff = (await sql`
    select st.id, st.name, st.active, st.commission_pct,
           coalesce(array_agg(ss.service_id::text) filter (where ss.service_id is not null), '{}') as service_ids
      from staff st
      left join staff_services ss on ss.staff_id = st.id
     where st.business_id = ${business.id}
     group by st.id, st.name, st.active, st.commission_pct
     order by st.active desc, st.name
  `) as Staff[];

  return (
    <main className="mt-6 space-y-4">
      <Guardado visible={q.ok === '1'} />
      {staff.length === 0 && <Empty>Aún no tienes especialistas. Agrega el primero abajo.</Empty>}

      {staff.length > 0 && (
      <div className="grid gap-4 lg:grid-cols-2">
      {staff.map((p) => (
        <Card key={p.id}>
          <form action={saveStaff} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={p.id} />
            <div className="min-w-40 flex-1">
              <Field label="Nombre">
                <Input name="name" defaultValue={p.name} required maxLength={80} />
              </Field>
            </div>
            <div className="w-24">
              <Field label="Comisión" hint="%">
                <Input name="commission_pct" type="number" inputMode="decimal"
                  min={0} max={100} step="1" defaultValue={Number(p.commission_pct)} />
              </Field>
            </div>
            <Button type="submit" tone="ghost" aria-label={`Guardar el nombre de ${p.name}`}>Guardar</Button>
            <Button type="submit" tone={p.active ? 'danger' : 'ghost'} formAction={toggleStaff}
              aria-label={`${p.active ? 'Dar de baja' : 'Reactivar'} a ${p.name}`}>
              {p.active ? 'Dar de baja' : 'Reactivar'}
            </Button>
          </form>

          <form action={setStaffServices} className="mt-4 border-t border-blush-100 pt-4">
            <input type="hidden" name="staff_id" value={p.id} />

            <p className="text-sm font-medium text-ink-soft">¿Qué servicios da?</p>

            {services.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                Primero crea servicios en la pestaña Servicios.
              </p>
            ) : (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-blush-200 bg-cream px-3 py-2 text-sm transition-colors duration-200 hover:bg-blush-50"
                    >
                      <input
                        type="checkbox"
                        name="service_ids"
                        value={s.id}
                        defaultChecked={p.service_ids.includes(s.id)}
                        className="h-4 w-4 shrink-0 accent-accent-600"
                      />
                      <span className={s.active ? 'text-ink' : 'text-ink-muted'}>
                        {s.name}
                        {!s.active && ' (oculto)'}
                      </span>
                    </label>
                  ))}
                </div>
                <Button type="submit" tone="ghost" className="mt-3" aria-label={`Guardar los servicios que da ${p.name}`}>
                  Guardar servicios
                </Button>
              </>
            )}
          </form>
        </Card>
      ))}
      </div>
      )}

      <Card title="Agregar especialista">
        <form action={saveStaff} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Nombre">
              <Input name="name" required maxLength={80} placeholder="Andrea" />
            </Field>
          </div>
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      <p className="px-1 text-sm text-ink-muted">
        Un especialista dado de baja deja de aparecer en la página pública, pero
        conserva sus citas anteriores.
      </p>
    </main>
  );
}
