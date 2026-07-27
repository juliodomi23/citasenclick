/**
 * Generación de archivos .ics (RFC 5545), sin dependencias.
 * ponytail: un .ics es texto plano con tres reglas raras (CRLF, escapado y
 * plegado a 75 octetos). Son 40 líneas contra una librería entera.
 */

const enc = new TextEncoder();

/** Escapado de campos de texto: RFC 5545 §3.3.11. El orden importa. */
export const escapeText = (v: string) =>
  v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Plegado de líneas largas: RFC 5545 §3.1. El límite es de **octetos**, no de
 * caracteres — "Barbería" ocupa 9 bytes, no 8, y cortar a mitad de un carácter
 * multibyte rompe el archivo en Outlook.
 */
export function fold(line: string): string {
  if (enc.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let cur = '';
  let curBytes = 0;

  for (const ch of line) {
    const n = enc.encode(ch).length;
    // Las líneas de continuación empiezan con un espacio, que también cuenta.
    const limit = parts.length === 0 ? 75 : 74;
    if (curBytes + n > limit) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += n;
  }
  if (cur) parts.push(cur);

  return parts.join('\r\n ');
}

/** Instante → YYYYMMDDTHHMMSSZ, siempre en UTC. */
export const icsStamp = (d: Date) =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  cancelled?: boolean;
  now?: Date;
};

export function buildIcs(e: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cita en Click//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsStamp(e.now ?? new Date())}`,
    `DTSTART:${icsStamp(e.start)}`,
    `DTEND:${icsStamp(e.end)}`,
    `SUMMARY:${escapeText(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF obligatorio, y el archivo termina con salto de línea.
  return lines.map(fold).join('\r\n') + '\r\n';
}
