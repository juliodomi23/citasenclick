// Todo lo que ya es una ruta real de la app. Si un negocio se registrara con
// slug "panel" o "api", su página pública quedaría inalcanzable para siempre
// detrás de la ruta de verdad — y ese negocio no lo nota hasta que un cliente
// suyo le dice que el link no sirve.
const RESERVED_SLUGS = new Set([
  'api', 'c', 'entrar', 'panel', 'superadmin', 'www', 'admin', 'login', 'logout',
]);

/** 3-40 caracteres, minúsculas/números/guion, sin guion al inicio o final. */
export function isValidSlug(v: string): boolean {
  // El grupo del medio NO es opcional: con `?` un solo carácter también
  // hacía match, y el comentario promete un mínimo de 3.
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v) && !RESERVED_SLUGS.has(v);
}

/** Un id que no es uuid revienta la query de Postgres; se rechaza antes. */
export const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Normaliza a E.164 mexicano. Acepta lo que la gente realmente escribe:
 * "961 123 4567", "9611234567", "+52 961 123 4567", "044 961...".
 * Devuelve null si no es un número mexicano plausible.
 * ponytail: sin libwphonenumber (500 KB) mientras el mercado sea México.
 */
export function normalizePhoneMX(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('52')) d = d.slice(2);
  if (d.startsWith('1') && d.length === 11) d = d.slice(1); // el viejo "+52 1"
  if (d.startsWith('044') || d.startsWith('045')) d = d.slice(3);
  return d.length === 10 ? `+52${d}` : null;
}
