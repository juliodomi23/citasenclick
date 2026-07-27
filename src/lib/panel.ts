export type PanelBusiness = {
  id: string; slug: string; name: string; timezone: string;
  whatsapp_phone: string | null; booking_window_days: number;
  min_notice_minutes: number; slot_granularity_minutes: number;
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
