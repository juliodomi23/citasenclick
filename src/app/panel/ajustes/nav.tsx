'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/panel/ajustes', label: 'Negocio' },
  { href: '/panel/ajustes/servicios', label: 'Servicios' },
  { href: '/panel/ajustes/equipo', label: 'Equipo' },
  { href: '/panel/ajustes/horarios', label: 'Horarios' },
];

export function AjustesNav() {
  const pathname = usePathname();

  return (
    <nav>
      <ul className="flex flex-wrap gap-1 rounded-xl border border-blush-200 bg-surface p-1 shadow-soft">
        {TABS.map((t) => {
          const active = t.href === '/panel/ajustes' ? pathname === '/panel/ajustes' : pathname.startsWith(t.href);
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
