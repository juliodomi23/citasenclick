import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, startOfWeek, civilDate } from './dates';

test('la semana empieza en lunes', () => {
  // 2026-07-27 es lunes; 2026-08-02 es el domingo que la cierra.
  assert.equal(startOfWeek('2026-07-27'), '2026-07-27', 'un lunes es su propio inicio');
  assert.equal(startOfWeek('2026-07-30'), '2026-07-27', 'jueves');
  assert.equal(startOfWeek('2026-08-02'), '2026-07-27', 'el domingo pertenece a la semana anterior');
  assert.equal(startOfWeek('2026-08-03'), '2026-08-03', 'el lunes siguiente ya es otra semana');
});

test('addDays cruza fin de mes, fin de año y año bisiesto', () => {
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29', '2028 es bisiesto');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01', '2026 no lo es');
});

test('sumar 7 días desde un lunes cae en el lunes siguiente', () => {
  assert.equal(startOfWeek(addDays('2026-07-27', 7)), '2026-08-03');
});

test('addDays sobrevive un cambio de horario de verano', () => {
  // EE.UU. adelanta el reloj el 2027-03-14. Anclar a mediodía UTC evita que
  // ese ±1h empuje el resultado al día equivocado.
  assert.equal(addDays('2027-03-13', 1), '2027-03-14');
  assert.equal(addDays('2027-03-14', 1), '2027-03-15');
});

test('civilDate agrupa por el día del negocio, no por el del servidor', () => {
  // 2026-08-06T02:00Z sigue siendo 5 de agosto en Tuxtla (UTC-6).
  assert.equal(civilDate('2026-08-06T02:00:00Z', 'America/Mexico_City'), '2026-08-05');
  assert.equal(civilDate('2026-08-06T02:00:00Z', 'UTC'), '2026-08-06');
});
