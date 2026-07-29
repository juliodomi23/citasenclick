/**
 * Fechas civiles ('YYYY-MM-DD') en la zona del negocio.
 * ponytail: Intl nativo en vez de luxon. Estas funciones corren también en el
 * cliente, y luxon son ~70 KB para sumar días.
 */

/** La fecha civil de un instante, en la zona del negocio. Para agrupar por día. */
export const civilDate = (instant: string | Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(instant));

/** Hoy, en la zona del negocio (no la del servidor ni la del navegador). */
export const todayIn = (tz: string) => civilDate(new Date(), tz);

/**
 * Suma días a una fecha civil. Se ancla a mediodía UTC para que ningún cambio
 * de horario de verano (±1h) empuje el resultado al día anterior o siguiente.
 */
export const addDays = (date: string, n: number) =>
  new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** El lunes de la semana que contiene `date`. La semana laboral empieza en lunes. */
export const startOfWeek = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0=domingo
  return addDays(date, -((d + 6) % 7));
};

export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** El día 1 del mes que contiene `date`. */
export const startOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

/** Día 1 del mes, `n` meses antes o después del mes de `date`. */
export const addMonths = (date: string, n: number) => {
  const [y, m] = date.slice(0, 7).split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
};
