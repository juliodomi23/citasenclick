'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/panel', label: 'Agenda' },
  { href: '/panel/servicios', label: 'Servicios' },
  { href: '/panel/equipo', label: 'Equipo' },
  { href: '/panel/horarios', label: 'Horarios' },
  { href: '/panel/ajustes', label: 'Ajustes' },
];

/*
  Las 5 pestañas necesitan 428px y en un celular hay 375: "Ajustes" quedaba
  fuera de la pantalla y solo se descubría deslizando, cosa que nadie hace en
  una barra que no parece deslizable. Se reparten en dos filas en celular y
  vuelven a una sola desde 640px.
*/

export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-5">
      <ul className="flex flex-wrap gap-1 rounded-xl border border-blush-200 bg-white p-1 shadow-soft sm:flex-nowrap">
        {TABS.map((t) => {
          const active = t.href === '/panel' ? pathname === '/panel' : pathname.startsWith(t.href);
          return (
            <li key={t.label} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors duration-200 ${
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
