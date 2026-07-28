import { loginSuperadmin } from './actions';
import { Field, Input, Button } from '@/components/panel-ui';
import { AlertTriangle } from '@/components/icons';

export default async function EntrarSuperadmin(props: PageProps<'/superadmin/entrar'>) {
  const q = await props.searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <header className="text-center">
        <h1 className="font-display text-2xl text-ink">Superadmin</h1>
        <p className="mt-2 text-sm text-ink-muted">Solo para Ámbar Rojo.</p>
      </header>

      <form action={loginSuperadmin} className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-soft-lg">
        {q.error === '1' && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Usuario o contraseña incorrectos.
          </p>
        )}

        <Field label="Usuario">
          <Input name="user" required autoComplete="username" autoFocus />
        </Field>

        <Field label="Contraseña">
          <Input name="pass" type="password" required autoComplete="current-password" />
        </Field>

        <Button type="submit" className="w-full">Entrar</Button>
      </form>
    </main>
  );
}
