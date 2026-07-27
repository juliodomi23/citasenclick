/**
 * Iconos de Lucide, en línea.
 * ponytail: son siete paths. `lucide-react` sería una dependencia entera para
 * esto. Si algún día hacen falta veinte, se instala el paquete.
 * Todos comparten viewBox 24x24 y heredan el color con currentColor.
 */
type Props = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const Check = ({ className = 'h-5 w-5' }: Props) => (
  <svg {...base} className={className}><path d="M20 6 9 17l-5-5" /></svg>
);

export const ChevronLeft = ({ className = 'h-5 w-5' }: Props) => (
  <svg {...base} className={className}><path d="m15 18-6-6 6-6" /></svg>
);

export const ChevronRight = ({ className = 'h-5 w-5' }: Props) => (
  <svg {...base} className={className}><path d="m9 18 6-6-6-6" /></svg>
);

export const Clock = ({ className = 'h-5 w-5' }: Props) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);

export const Calendar = ({ className = 'h-5 w-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M8 2v4M16 2v4M3 10h18" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
  </svg>
);

export const MessageCircle = ({ className = 'h-5 w-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
  </svg>
);

export const AlertTriangle = ({ className = 'h-5 w-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
