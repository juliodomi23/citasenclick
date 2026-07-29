'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/panel', label: 'Agenda' },
  { href: '/panel/caja', label: 'Caja' },
  { href: '/panel/inventario', label: 'Inventario' },
  { href: '/panel/servicios', label: 'Servicios' },
  { href: '/panel/equipo', label: 'Equipo' },
  { href: '/panel/horarios', label: 'Horarios' },
  { href: '/panel/ajustes', label: 'Ajustes' },
];

/*
  Las 7 pestañas necesitan más de 428px y en un celular hay 375: se reparten
  en dos filas y vuelven a una sola desde 640px.

  Desde lg (tablet horizontal / desktop) dejan de ser tabs horizontales y se
  vuelven una barra lateral fija: con el panel ya usando el ancho completo de
  la pantalla, una fila de tabs se ve estirada y vacía por dentro — una
  columna angosta de accesos aprovecha mejor el alto disponible en un
  mostrador con la tablet fija.
*/

export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:w-48 lg:shrink-0">
      <ul className="flex flex-wrap gap-1 rounded-xl border border-blush-200 bg-surface p-1 shadow-soft sm:flex-nowrap lg:flex-col lg:flex-nowrap">
        {TABS.map((t) => {
          const active = t.href === '/panel' ? pathname === '/panel' : pathname.startsWith(t.href);
          return (
            <li key={t.label} className="flex-1 lg:flex-none">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors duration-200 lg:justify-start lg:px-4 ${
                  active ? 'bg-accent-600 font-medium text-white' : 'text-ink-soft hover:bg-blush-50'
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
