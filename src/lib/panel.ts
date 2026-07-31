export type PanelBusiness = {
  id: string; slug: string; name: string; timezone: string;
  whatsapp_phone: string | null; booking_window_days: number;
  min_notice_minutes: number; slot_granularity_minutes: number;
  logo_url: string | null; theme: Theme; review_url: string | null;
};

/** Temas de marca disponibles. Curados a mano (acento + superficies + borde
    de control ya probados en claro/oscuro) en vez de un selector de color
    libre: así ninguna combinación que elija el superadmin rompe el contraste. */
export const THEMES = ['rosa', 'azul', 'verde', 'ambar', 'grafito'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_LABEL: Record<Theme, string> = {
  rosa: 'Rosa', azul: 'Azul', verde: 'Verde', ambar: 'Ámbar', grafito: 'Grafito',
};

export const DAYS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
] as const;

/** Zonas con las que trabaja el negocio. Se amplía cuando haya un cliente fuera. */
export const TIMEZONES = [
  'America/Mexico_City',
  'America/Cancun',
  'America/Tijuana',
  'America/Hermosillo',
  'America/Monterrey',
] as const;

/** 'HH:MM' o 'HH:MM:SS' → 'HH:MM', que es lo que acepta <input type="time">. */
export const hhmm = (t: string) => t.slice(0, 5);
