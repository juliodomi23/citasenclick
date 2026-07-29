'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Wallet, Users, Package, Settings } from '@/components/icons';

const TABS = [
  { href: '/panel', label: 'Agenda', Icon: Calendar },
  { href: '/panel/caja', label: 'Caja', Icon: Wallet },
  { href: '/panel/clientes', label: 'Clientes', Icon: Users },
  { href: '/panel/inventario', label: 'Inventario', Icon: Package },
  { href: '/panel/ajustes', label: 'Ajustes', Icon: Settings },
];

/*
  Servicios, Equipo y Horarios ya no son pestañas de primer nivel: viven
  dentro de Ajustes (ver panel/ajustes/nav.tsx). 8 accesos arriba era
  demasiado para escanear rápido; 5 sí se leen de un vistazo.

  Mismo componente en los dos tamaños de pantalla, sin bifurcar el archivo:
  - Desde lg, es la barra lateral fija (columna, todo el alto disponible).
  - Antes de lg, es un <details> nativo: cero JS de estado propio, el
    navegador hace el desplegar/cerrar. `key={pathname}` lo fuerza a
    cerrado cada vez que cambia de página (si no, seguiría abierto después
    de tocar un link, porque la navegación no vuelve a montar el layout).
*/

export function PanelNav() {
  const pathname = usePathname();

  const links = TABS.map(({ href, label, Icon }) => {
    const active = href === '/panel' ? pathname === '/panel' : pathname.startsWith(href);
    return (
      <li key={label}>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-200 ${
            active ? 'bg-accent-600 font-medium text-white' : 'text-ink-soft hover:bg-blush-50'
          }`}
        >
          <Icon className="h-4.5 w-4.5 shrink-0" />
          {label}
        </Link>
      </li>
    );
  });

  const current = TABS.find((t) => (t.href === '/panel' ? pathname === '/panel' : pathname.startsWith(t.href)));

  return (
    <>
      {/* Menú desplegable: solo antes de lg. */}
      <details key={pathname} className="rounded-xl border border-blush-200 bg-surface shadow-soft lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 shrink-0" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {current?.label ?? 'Menú'}
        </summary>
        <ul className="space-y-1 border-t border-blush-100 p-2">{links}</ul>
      </details>

      {/* Barra lateral: solo desde lg, todo el alto de la pantalla. */}
      <nav className="hidden lg:sticky lg:top-8 lg:block lg:w-56 lg:shrink-0 lg:self-start">
        <ul className="space-y-1 rounded-xl border border-blush-200 bg-surface p-2 shadow-soft">{links}</ul>
      </nav>
    </>
  );
}
