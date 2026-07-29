import { sql } from '@/lib/db';
import { requireBusiness } from '@/lib/auth';
import { saveProduct, toggleProduct } from '../admin';
import { Card, Field, Input, Button, Empty, Guardado } from '@/components/panel-ui';

type Product = {
  id: string; name: string; price_cents: number; stock: number; active: boolean;
};

export default async function Inventario(props: PageProps<'/panel/inventario'>) {
  const business = await requireBusiness();
  const q = await props.searchParams;

  const products = (await sql`
    select id, name, price_cents, stock, active
      from products where business_id = ${business.id}
     order by active desc, name
  `) as Product[];

  return (
    <main className="mt-6 space-y-4">
      <Guardado visible={q.ok === '1'} />
      {products.length === 0 && (
        <Empty>Aún no tienes productos. Agrega el primero abajo.</Empty>
      )}

      {products.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {products.map((p) => (
            <Card key={p.id}>
              <form action={saveProduct} className="space-y-4">
                <input type="hidden" name="id" value={p.id} />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Field label="Nombre">
                      <Input name="name" defaultValue={p.name} required maxLength={80} />
                    </Field>
                  </div>
                  {!p.active && (
                    <span className="mt-7 shrink-0 rounded-full border border-blush-200 bg-blush-50 px-2.5 py-1 text-xs text-ink-muted">
                      Oculto
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Precio" hint="MXN">
                    <Input name="price" type="number" inputMode="decimal"
                      min={0} step="1" defaultValue={(p.price_cents / 100).toFixed(0)} />
                  </Field>
                  <Field label="Existencias">
                    <Input name="stock" type="number" inputMode="numeric"
                      min={0} step="1" defaultValue={p.stock} required />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" aria-label={`Guardar ${p.name}`}>Guardar</Button>
                  <Button
                    type="submit"
                    tone={p.active ? 'danger' : 'ghost'}
                    formAction={toggleProduct}
                    aria-label={`${p.active ? 'Ocultar' : 'Volver a mostrar'} ${p.name}`}
                  >
                    {p.active ? 'Ocultar' : 'Volver a mostrar'}
                  </Button>
                </div>
              </form>
            </Card>
          ))}
        </div>
      )}

      <Card title="Agregar producto" hint="Cera, shampoo, cualquier cosa que vendas suelta.">
        <form action={saveProduct} className="space-y-4">
          <Field label="Nombre">
            <Input name="name" required maxLength={80} placeholder="Cera moldeadora" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio" hint="MXN">
              <Input name="price" type="number" inputMode="decimal" min={0} step="1" defaultValue={0} />
            </Field>
            <Field label="Existencias">
              <Input name="stock" type="number" inputMode="numeric" min={0} step="1" defaultValue={0} required />
            </Field>
          </div>
          <Button type="submit">Agregar producto</Button>
        </form>
      </Card>

      <p className="px-1 text-sm text-ink-muted">
        Los productos no se borran: se ocultan. Así las ventas viejas conservan su historial.
        Las existencias bajan solas cuando registras una venta en Caja.
      </p>
    </main>
  );
}
