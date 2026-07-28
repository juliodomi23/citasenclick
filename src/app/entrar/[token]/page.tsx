import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth';
import { setupPassword } from './actions';
import { Field, Input, Button } from '@/components/panel-ui';
import { AlertTriangle } from '@/components/icons';

export default async function SetupPassword(props: PageProps<'/entrar/[token]'>) {
  if (await currentSession()) redirect('/panel');

  const { token } = await props.params;
  const q = await props.searchParams;
  const error = typeof q.error === 'string' ? q.error : null;

  const validToken = /^[0-9a-f]{32}$/.test(token);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <header className="text-center">
        <h1 className="font-display text-3xl text-ink">Crea tu contraseña</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Esta será tu contraseña de acceso
        </p>
      </header>

      {validToken ? (
        <form action={setupPassword} className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-soft-lg">
          <input type="hidden" name="token" value={token} />

          {error === 'invalid' && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              La contraseña debe tener mayúscula, número y al menos 8 caracteres
            </p>
          )}

          {error === 'expired' && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              El enlace expiró. Pide uno nuevo en el panel.
            </p>
          )}

          <Field label="Nueva contraseña" hint="Mayúscula, número, 8+ caracteres">
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              placeholder="Ej: Contraseña123"
            />
          </Field>

          <Button type="submit" className="w-full">
            Establecer contraseña
          </Button>
        </form>
      ) : (
        <div className="mt-8 rounded-2xl bg-white p-6 text-center shadow-soft-lg">
          <p className="text-sm text-ink-muted">
            El enlace no es válido. Pide uno nuevo.
          </p>
          <a
            href="/entrar"
            className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-700"
          >
            Volver a intentar
          </a>
        </div>
      )}
    </main>
  );
}
