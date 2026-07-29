import Link from 'next/link';
import { sql } from '@/lib/db';
import { TIMEZONES, THEMES, THEME_LABEL, type Theme } from '@/lib/panel';
import { createBusiness, updateBranding } from './actions';
import { logoutSuperadmin } from './entrar/actions';
import { Card, Field, Input, Select, Button, Empty } from '@/components/panel-ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { DeleteBusinessForm } from './delete-button';

type Row = {
  slug: string;
  name: string;
  timezone: string;
  created_at: string;
  logo_url: string | null;
  theme: Theme;
  owner_phone: string | null;
  servicios: number;
  citas: number;
};

const ERROR_LABEL: Record<string, string> = {
  slug: 'Nombre o slug inválido. El slug solo lleva minúsculas, números y guiones.',
  'slug-tomado': 'Ya existe un negocio con ese slug.',
  zona: 'Zona horaria inválida.',
  telefono: 'El WhatsApp del dueño debe ser un número mexicano de 10 dígitos.',
  'telefono-negocio': 'El WhatsApp del negocio debe ser un número mexicano de 10 dígitos.',
  'no-existe': 'Ese negocio no existe.',
};

export default async function Superadmin(props: PageProps<'/superadmin'>) {
  const q = await props.searchParams;

  const businesses = (await sql`
    select b.slug, b.name, b.timezone, b.created_at, b.logo_url, b.theme,
           (select phone from users where business_id = b.id and role = 'owner' limit 1) as owner_phone,
           (select count(*)::int from services where business_id = b.id and active) as servicios,
           (select count(*)::int from appointments where business_id = b.id) as citas
      from businesses b
     order by b.created_at desc
  `) as Row[];

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const errorMsg = typeof q.error === 'string' ? ERROR_LABEL[q.error] ?? 'No se pudo crear.' : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-2xl text-ink">Superadmin — Cita en Click</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action={logoutSuperadmin}>
            <button className="min-h-11 cursor-pointer text-sm text-ink-muted transition-colors duration-200 hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Alta de negocios del piloto. Solo para nosotros.
      </p>

      {errorMsg && (
        <p role="alert" className="mt-4 rounded-xl border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
          {errorMsg}
        </p>
      )}
      {typeof q.ok === 'string' && (
        <p role="status" className="mt-4 rounded-xl border border-success-border bg-success-bg p-3 text-sm text-success-text">
          <strong>{q.ok}</strong> está listo. El dueño ya puede pedir su enlace en{' '}
          <Link href="/entrar" className="underline">/entrar</Link> con el teléfono que registraste.
        </p>
      )}
      {typeof q.deleted === 'string' && (
        <p role="status" className="mt-4 rounded-xl border border-success-border bg-success-bg p-3 text-sm text-success-text">
          <strong>{q.deleted}</strong> fue eliminado completamente de la base de datos.
        </p>
      )}

      <div className="mt-6">
        <Card title="Nuevo negocio">
          <form action={createBusiness} className="space-y-4">
            <Field label="Nombre del negocio">
              <Input name="name" required maxLength={80} placeholder="Estética Belleza Total" />
            </Field>

            <Field label="Slug" hint="va en la URL pública, minúsculas y guiones">
              <Input
                name="slug" required pattern="[a-z0-9-]+" maxLength={40}
                placeholder="belleza-total"
              />
            </Field>

            <Field label="Zona horaria">
              <Select name="timezone" defaultValue="America/Mexico_City">
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.split('/')[1].replace('_', ' ')}</option>
                ))}
              </Select>
            </Field>

            <Field label="WhatsApp del dueño" hint="10 dígitos — con ese número entra al panel">
              <Input name="owner_phone" required type="tel" inputMode="numeric" placeholder="961 123 4567" />
            </Field>

            <Field label="WhatsApp del negocio" hint="10 dígitos, opcional — el que ven las clientas">
              <Input name="whatsapp_phone" type="tel" inputMode="numeric" placeholder="961 123 4567" />
            </Field>

            <Field label="Logo" hint="URL de imagen, opcional — se puede poner después">
              <Input name="logo_url" type="url" placeholder="https://..." />
            </Field>

            <Field label="Tema de color">
              <Select name="theme" defaultValue="rosa">
                {THEMES.map((t) => (
                  <option key={t} value={t}>{THEME_LABEL[t]}</option>
                ))}
              </Select>
            </Field>

            <Button type="submit">Crear negocio</Button>
          </form>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg text-ink">
        Negocios ({businesses.length})
      </h2>

      {businesses.length === 0 ? (
        <Empty>Sin negocios todavía.</Empty>
      ) : (
        <div className="space-y-3">
          {businesses.map((b) => (
            <div key={b.slug} data-theme={b.theme} className="rounded-xl border border-blush-200 bg-surface p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {b.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria por negocio.
                    <img src={b.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="font-medium text-ink">{b.name}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {b.servicios} servicio{b.servicios === 1 ? '' : 's'} · {b.citas} cita{b.citas === 1 ? '' : 's'} ·{' '}
                      {b.owner_phone ?? 'sin dueño registrado'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <a href={`${base}/${b.slug}`} className="text-sm text-accent-700 underline">
                    /{b.slug}
                  </a>
                  <DeleteBusinessForm slug={b.slug} name={b.name} />
                </div>
              </div>

              <form action={updateBranding} className="mt-4 space-y-3 border-t border-blush-100 pt-4">
                <input type="hidden" name="slug" value={b.slug} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Nombre">
                    <Input name="name" defaultValue={b.name} required maxLength={80} />
                  </Field>
                  <Field label="Logo" hint="URL">
                    <Input name="logo_url" type="url" defaultValue={b.logo_url ?? ''} placeholder="https://..." />
                  </Field>
                  <Field label="Tema">
                    <Select name="theme" defaultValue={b.theme}>
                      {THEMES.map((t) => (
                        <option key={t} value={t}>{THEME_LABEL[t]}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button type="submit" tone="ghost" aria-label={`Guardar marca de ${b.name}`}>
                  Guardar marca
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
