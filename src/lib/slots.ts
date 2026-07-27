import { DateTime, Interval } from 'luxon';

export type LocalWindow = { start_time: string; end_time: string };
export type Busy = { starts_at: Date | string; ends_at: Date | string };

export type SlotInput = {
  date: string;            // 'YYYY-MM-DD' en la zona del negocio
  timezone: string;        // IANA, del negocio (nunca del navegador)
  windows: LocalWindow[];  // horario del día, en hora local
  busy: Busy[];            // citas confirmadas del especialista
  durationMinutes: number;
  bufferMinutes: number;
  granularityMinutes: number;
  minNoticeMinutes: number;
  now?: DateTime;
};

/**
 * Genera los slots disponibles de un día. Función pura: toda la lógica de
 * ARQUITECTURA.md §3.B.3 vive aquí para poder probarla sin base de datos.
 * Devuelve instantes UTC en ISO.
 */
export function computeSlots(input: SlotInput): string[] {
  const {
    date, timezone, windows, busy,
    durationMinutes, bufferMinutes, granularityMinutes, minNoticeMinutes,
  } = input;

  const now = input.now ?? DateTime.utc();
  const earliest = now.plus({ minutes: minNoticeMinutes });
  const occupied = busy.map((b) =>
    Interval.fromDateTimes(DateTime.fromJSDate(new Date(b.starts_at)), DateTime.fromJSDate(new Date(b.ends_at)))
  );
  const total = durationMinutes + bufferMinutes;
  const slots: string[] = [];

  for (const w of windows) {
    // Hora local del negocio -> instante UTC, para este día concreto.
    const windowStart = DateTime.fromISO(`${date}T${w.start_time}`, { zone: timezone });
    const windowEnd = DateTime.fromISO(`${date}T${w.end_time}`, { zone: timezone });
    if (!windowStart.isValid || !windowEnd.isValid) continue;

    for (let s = windowStart; s.plus({ minutes: total }) <= windowEnd; s = s.plus({ minutes: granularityMinutes })) {
      if (s < earliest) continue;
      const candidate = Interval.fromDateTimes(s, s.plus({ minutes: total }));
      if (occupied.some((o) => o.overlaps(candidate))) continue;
      slots.push(s.toUTC().toISO()!);
    }
  }

  return [...new Set(slots)].sort();
}
