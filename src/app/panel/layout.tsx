import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentSession } from '@/lib/auth';
import { logout } from '../entrar/actions';
import { PanelNav } from './nav';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Única puerta del panel: sin sesión no se renderiza nada, ni las subrutas.
  const session = await currentSession();
  if (!session) redirect('/entrar');
  const { business } = session;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-2xl text-ink">{business.name}</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href={`/${business.slug}`}
            className="inline-flex min-h-11 cursor-pointer items-center text-accent-700 underline decoration-accent-200 underline-offset-2 transition-colors duration-200 hover:text-accent-600"
          >
            Ver página pública
          </Link>
          <form action={logout}>
            <button className="min-h-11 cursor-pointer text-ink-muted transition-colors duration-200 hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </header>

      <PanelNav />

      {children}
    </div>
  );
}
