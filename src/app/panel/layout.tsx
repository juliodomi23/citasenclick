import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentSession } from '@/lib/auth';
import { logout } from '../entrar/actions';
import { PanelNav } from './nav';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Única puerta del panel: sin sesión no se renderiza nada, ni las subrutas.
  const session = await currentSession();
  if (!session) redirect('/entrar');
  const { business } = session;

  return (
    <div data-theme={business.theme} className="theme-halo min-h-full">
      {/*
        max-w-2xl (672px) es del tamaño justo para celular/tablet vertical,
        pero en tablet horizontal (1024px+) y desktop deja cientos de píxeles
        vacíos a los lados — la razón de que el panel se sintiera "de celular
        estirado" en el mostrador, que es donde más se usa.
      */}
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 lg:max-w-6xl">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-3">
            {business.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del cliente, sin dominio fijo que darle a next/image.
              <img src={business.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            )}
            <h1 className="font-display text-2xl text-ink">{business.name}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <ThemeToggle />
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

        <div className="mt-5 lg:flex lg:items-start lg:gap-8">
          <PanelNav />
          {/* Cada page.tsx ya trae su propio <main>: este div solo es el
              carril de ancho, no se puede anidar otro <main> dentro. */}
          <div className="mt-5 min-w-0 flex-1 lg:mt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
