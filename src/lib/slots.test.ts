import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { computeSlots } from './slots';

const TZ = 'America/Mexico_City'; // UTC-6 sin horario de verano
const base = {
  date: '2026-08-05',            // miércoles
  timezone: TZ,
  busy: [],
  durationMinutes: 30,
  bufferMinutes: 5,
  granularityMinutes: 15,
  minNoticeMinutes: 120,
  now: DateTime.fromISO('2026-08-01T12:00:00Z'),  // muy antes: no filtra nada
};

const local = (iso: string) => DateTime.fromISO(iso).setZone(TZ).toFormat('HH:mm');

test('genera slots en hora local del negocio, no del servidor', () => {
  const slots = computeSlots({ ...base, windows: [{ start_time: '09:00', end_time: '14:00' }] });
  assert.equal(local(slots[0]), '09:00');
  // 09:00 en Tuxtla = 15:00 UTC
  assert.equal(slots[0], '2026-08-05T15:00:00.000Z');
});

test('el último slot cabe completo con su buffer dentro de la ventana', () => {
  const slots = computeSlots({ ...base, windows: [{ start_time: '09:00', end_time: '14:00' }] });
  // Los slots caen en la rejilla de 15 min desde el inicio de la ventana.
  // 13:15 + 35 = 13:50 cabe; 13:30 + 35 = 14:05 se pasaría.
  assert.equal(local(slots.at(-1)!), '13:15');
});

test('turno partido produce dos bloques sin inventar el hueco', () => {
  const slots = computeSlots({
    ...base,
    windows: [{ start_time: '09:00', end_time: '14:00' }, { start_time: '16:00', end_time: '20:00' }],
  }).map(local);
  assert.ok(slots.includes('13:15') && slots.includes('16:00'));
  assert.ok(!slots.some((h) => h > '13:15' && h < '16:00'));
});

test('una cita confirmada bloquea los slots que se traslapan', () => {
  const slots = computeSlots({
    ...base,
    windows: [{ start_time: '09:00', end_time: '14:00' }],
    busy: [{ starts_at: '2026-08-05T16:00:00Z', ends_at: '2026-08-05T16:35:00Z' }], // 10:00-10:35 local
  }).map(local);
  // Cualquier slot cuyo rango [inicio, inicio+35) toque 10:00-10:35 debe desaparecer.
  for (const h of ['09:30', '09:45', '10:00', '10:15', '10:30']) assert.ok(!slots.includes(h), h);
  assert.ok(slots.includes('09:15'), 'termina 09:50, no estorba');
  assert.ok(slots.includes('10:45'), 'el siguiente slot libre de la rejilla');
});

test('min_notice_minutes descarta lo que ya está demasiado cerca', () => {
  const slots = computeSlots({
    ...base,
    date: '2026-08-05',
    windows: [{ start_time: '09:00', end_time: '14:00' }],
    now: DateTime.fromISO('2026-08-05T16:00:00Z'), // 10:00 local + 2h de anticipación
  }).map(local);
  assert.equal(slots[0], '12:00');
});

test('día cerrado (sin ventanas) no ofrece nada', () => {
  assert.deepEqual(computeSlots({ ...base, windows: [] }), []);
});

test('la zona horaria del negocio manda, no la del proceso', () => {
  const cancun = computeSlots({ ...base, timezone: 'America/Cancun', windows: [{ start_time: '09:00', end_time: '14:00' }] });
  const tuxtla = computeSlots({ ...base, windows: [{ start_time: '09:00', end_time: '14:00' }] });
  assert.equal(cancun[0], '2026-08-05T14:00:00.000Z'); // Cancún es UTC-5
  assert.notEqual(cancun[0], tuxtla[0]);
});
