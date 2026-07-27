/** Piezas compartidas del panel. Sin librería de componentes: son seis. */

export function Card({ title, hint, children }: {
  title?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-blush-200 bg-white p-5 shadow-soft">
      {title && <h2 className="font-display text-lg text-ink">{title}</h2>}
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className={title || hint ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink-soft">
        {label}
        {hint && <span className="ml-1.5 font-normal text-ink-muted">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

// Ocupa todo el ancho de su contenedor. Para hacerlo más angosto, envuélvelo en
// un div del ancho que quieras: pasarle `w-32` por className no funciona, porque
// el choque entre dos clases de width lo resuelve el orden del CSS generado, no
// el de la cadena.
const inputClass =
  'min-h-11 w-full rounded-xl border border-border-control bg-cream px-3 text-base text-ink';

export function Input(props: React.ComponentProps<'input'>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: React.ComponentProps<'select'>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

type ButtonTone = 'primary' | 'ghost' | 'danger';

const TONES: Record<ButtonTone, string> = {
  primary: 'border-accent-600 bg-accent-600 text-white hover:bg-accent-700',
  ghost: 'border-border-control bg-white text-ink-soft hover:bg-blush-50',
  // El fondo va en cada variante, nunca en la base: dos clases de background en
  // la misma cadena las resuelve el orden del CSS, no el de la cadena.
  danger: 'border-red-200 bg-white text-red-700 hover:bg-red-50',
};

export function Button({
  tone = 'primary', className = '', ...props
}: React.ComponentProps<'button'> & { tone?: ButtonTone }) {
  return (
    <button
      {...props}
      className={`min-h-11 cursor-pointer rounded-xl border px-4 text-sm font-medium transition-colors duration-200 disabled:opacity-60 ${TONES[tone]} ${className}`}
    />
  );
}

/**
 * Confirmación de guardado. Las server actions revalidan y repintan la misma
 * pantalla: sin esto no hay ninguna señal de que el cambio se guardó, ni
 * visual ni para un lector de pantalla.
 */
export function Guardado({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      Cambios guardados.
    </p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-blush-200 bg-cream px-4 py-6 text-center text-sm text-ink-muted">
      {children}
    </p>
  );
}
