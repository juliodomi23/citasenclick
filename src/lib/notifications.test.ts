import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, secretMatches, type DueNotification } from './notifications';

const base: DueNotification = {
  id: '42',
  kind: 'reminder_24h',
  customer_name: 'Ana López',
  customer_phone: '+529615558899',
  starts_at: '2026-08-05T15:00:00.000Z', // 09:00 en Tuxtla
  service_name: 'Corte de cabello',
  staff_name: 'Miguel',
  business_name: 'Barbería El Cañón',
  business_phone: '+529611234567',
  timezone: 'America/Mexico_City',
  manage_token: 'abc123',
};

test('el payload lleva la hora del negocio ya formateada, no un ISO en UTC', () => {
  const p = buildPayload(base, 'https://mi-app.com');
  assert.equal(p.hora_local, '09:00', 'n8n no debe hacer aritmética de zonas');
  // Sin año a propósito: la ventana de reserva son 30 días, en WhatsApp estorba.
  assert.equal(p.fecha_local, 'miércoles, 5 de agosto');
});

test('la zona del negocio manda: el mismo instante cambia de hora y de día', () => {
  const cancun = buildPayload({ ...base, timezone: 'America/Cancun' }, 'https://mi-app.com');
  assert.equal(cancun.hora_local, '10:00', 'Cancún es UTC-5');

  // 02:00Z del 6 sigue siendo día 5 en Tuxtla: el recordatorio no debe adelantar el día.
  const madrugada = buildPayload({ ...base, starts_at: '2026-08-06T02:00:00.000Z' }, 'https://mi-app.com');
  assert.match(madrugada.fecha_local, /5 de agosto/);
});

test('manage_url queda usable y sin barra doble', () => {
  assert.equal(
    buildPayload(base, 'https://mi-app.com/').manage_url,
    'https://mi-app.com/c/abc123'
  );
});

test('el payload trae todo lo que la plantilla de Meta necesita', () => {
  const p = buildPayload(base, 'https://mi-app.com');
  for (const k of ['kind', 'nombre', 'telefono', 'servicio', 'especialista',
                   'fecha_local', 'hora_local', 'negocio', 'manage_url'] as const) {
    assert.ok(p[k], `falta ${k}`);
  }
  assert.equal(p.telefono, '+529615558899', 'E.164, como lo quiere la API de Meta');
});

test('el secreto del cron no se puede evadir con vacíos ni prefijos', () => {
  assert.equal(secretMatches('s3cr3to', 's3cr3to'), true);
  assert.equal(secretMatches('s3cr3t', 's3cr3to'), false, 'prefijo correcto no basta');
  assert.equal(secretMatches('', ''), false);
  assert.equal(secretMatches(null, 's3cr3to'), false);
  assert.equal(secretMatches('s3cr3to', undefined), false, 'sin CRON_SECRET no se pasa');
});
