import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeText, fold, icsStamp } from './ics';

const base = {
  uid: 'abc123@citas',
  start: new Date('2026-08-05T15:00:00Z'),
  end: new Date('2026-08-05T15:30:00Z'),
  summary: 'Corte de cabello',
  now: new Date('2026-07-26T18:00:00Z'),
};

test('las fechas van en UTC con el formato del RFC', () => {
  assert.equal(icsStamp(new Date('2026-08-05T15:00:00Z')), '20260805T150000Z');
});

test('el archivo usa CRLF y cierra con salto de línea', () => {
  const ics = buildIcs(base);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'no debe quedar ningún \\n suelto sin su \\r');
});

test('escapa los caracteres que romperían el formato', () => {
  assert.equal(escapeText('Corte, barba; y más'), 'Corte\\, barba\\; y más');
  assert.equal(escapeText('a\\b'), 'a\\\\b');
  assert.equal(escapeText('línea1\nlínea2'), 'línea1\\nlínea2');
});

test('una coma en el nombre del negocio no parte el campo', () => {
  const ics = buildIcs({ ...base, summary: 'Corte, barba y cejas' });
  assert.ok(ics.includes('SUMMARY:Corte\\, barba y cejas'));
});

test('las líneas largas se pliegan sin partir un carácter acentuado', () => {
  // "Barbería" ocupa 9 octetos, no 8: plegar por caracteres corrompería el archivo.
  const largo = 'Estética y Spa Señorial ' + 'á'.repeat(80);
  const folded = fold(`SUMMARY:${largo}`);

  for (const line of folded.split('\r\n')) {
    assert.ok(
      new TextEncoder().encode(line).length <= 75,
      `línea de ${new TextEncoder().encode(line).length} octetos`
    );
  }
  assert.ok(folded.includes('\r\n '), 'las continuaciones empiezan con espacio');
  // Al desplegar se recupera el texto original, sin caracteres rotos.
  assert.equal(folded.split('\r\n ').join(''), `SUMMARY:${largo}`);
});

test('una cita cancelada se marca como tal para que el calendario la borre', () => {
  assert.ok(buildIcs({ ...base, cancelled: true }).includes('STATUS:CANCELLED'));
  assert.ok(buildIcs(base).includes('STATUS:CONFIRMED'));
});

test('el UID es estable: reimportar actualiza la cita en vez de duplicarla', () => {
  assert.ok(buildIcs(base).includes('UID:abc123@citas'));
});
