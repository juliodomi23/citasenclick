import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth';
import { login, requestLink } from './actions';
import { Field, Input, Button } from '@/components/panel-ui';
import { MessageCircle, Check, AlertTriangle, Lock } from '@/components/icons';

export default async function Entrar(props: PageProps<'/entrar'>) {
  if (await currentSession()) redirect('/panel');

  const q = await props.searchParams;
  const enviado = q.enviado === '1';
  const linkPiloto = typeof q.link === 'string' ? q.link : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <header className="text-center">
        <h1 className="font-display text-3xl text-ink">Entrar a tu panel</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Con tu número de WhatsApp y contraseña
        </p>
      </header>

      {enviado ? (
        <section className="mt-8 rounded-2xl bg-white p-6 text-center shadow-soft-lg">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white">
            <Check className="h-6 w-6" />
          </span>
          <p className="mt-4 font-medium text-ink">Revisa tu WhatsApp</p>
          <p className="mt-2 text-sm text-ink-muted">
            Si ese número está registrado, te llegó un enlace para crear tu
            contraseña. Vence en 15 minutos.
          </p>

          {linkPiloto && (
            <div className="mt-4 rounded-xl border border-dashed border-blush-200 bg-blush-50 p-4 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Modo piloto — mientras se activa el envío por WhatsApp
              </p>
              <a
                href={linkPiloto}
                className="mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-700"
              >
                Crear contraseña ahora
              </a>
            </div>
          )}

          <a
            href="/entrar"
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center text-sm text-accent-700 underline decoration-accent-200 underline-offset-2"
          >
            Probar con otro número
          </a>
        </section>
      ) : (
        <form action={login} className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-soft-lg">
          {q.error === 'telefono' && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Ese número no parece válido. Deben ser 10 dígitos.
            </p>
          )}

          {q.error === 'credenciales' && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Número o contraseña incorrectos.
            </p>
          )}

          {q.error === 'sin-cuenta' && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Ese número no tiene cuenta aún. Pide un enlace de acceso al negocio.
            </p>
          )}

          <Field label="Tu WhatsApp" hint="10 dígitos">
            <Input
              name="phone" type="tel" inputMode="numeric" autoComplete="tel"
              required placeholder="961 123 4567" autoFocus
            />
          </Field>

          <Field label="Contraseña">
            <Input
              name="password" type="password" autoComplete="current-password"
              required placeholder="Tu contraseña"
            />
          </Field>

          <Button type="submit" className="flex w-full items-center justify-center gap-2">
            <Lock className="h-4 w-4" />
            Entrar
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-ink-muted">
        ¿Eres cliente y quieres agendar? Pídele su enlace al negocio.
      </p>
    </main>
  );
}
