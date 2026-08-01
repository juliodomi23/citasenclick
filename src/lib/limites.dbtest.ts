/**
 * Pruebas contra una base de datos real. Separadas de los tests normales
 * (`*.test.ts`, funciones puras) porque necesitan DATABASE_URL: se corren con
 * `npm run test:db` antes de un deploy, no en cada guardado.
 *
 * Usan las funciones de verdad, no copias de su lógica: una prueba que
 * reimplementa lo que valida no prueba nada. Cada test limpia lo que crea.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql, closeConnection } from './db';
import { hitLimit, purgeOldLimits, LIMITS } from './rate-limit';
import { purgeOldWaitlist } from './waitlist';

// db.ts abre la conexión en la primera query, no al importar, así que basta
// con dejar DATABASE_URL puesta antes del primer test. En local vive en
// .env.local; en CI o en el VPS ya viene del entorno.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = readFileSync('.env.local', 'utf8')
    .match(/DATABASE_URL="(.+)"/)?.[1];
}

const TEL = '+52999TESTLIMITE';

test.after(async () => {
  await sql`delete from rate_limits where key like '+52999TEST%'`;
  await closeConnection();
});

test('el tope de reservas deja pasar el máximo y bloquea el siguiente', async () => {
  await sql`delete from rate_limits where key = ${TEL}`;
  const { max } = LIMITS.booking;

  for (let i = 1; i <= max; i++) {
    assert.equal(await hitLimit('booking', TEL), false, `el intento ${i} debía pasar`);
  }
  assert.equal(await hitLimit('booking', TEL), true, 'pasado el tope debe bloquear');
});

test('los topes no se contaminan entre buckets ni entre teléfonos', async () => {
  const otro = '+52999TESTOTRO';
  await sql`delete from rate_limits where key in (${TEL}, ${otro})`;

  for (let i = 0; i < LIMITS.booking.max; i++) await hitLimit('booking', TEL);

  assert.equal(await hitLimit('booking', TEL), true, 'el teléfono topado sigue topado');
  assert.equal(await hitLimit('waitlist', TEL), false, 'otro bucket no hereda el tope');
  assert.equal(await hitLimit('booking', otro), false, 'otro teléfono no hereda el tope');
});

test('un intento rechazado no alarga el bloqueo', async () => {
  await sql`delete from rate_limits where key = ${TEL}`;
  for (let i = 0; i < LIMITS.booking.max; i++) await hitLimit('booking', TEL);

  const antes = (await sql`select count(*)::int as n from rate_limits where key = ${TEL}`) as { n: number }[];
  await hitLimit('booking', TEL);
  await hitLimit('booking', TEL);
  const despues = (await sql`select count(*)::int as n from rate_limits where key = ${TEL}`) as { n: number }[];

  assert.equal(despues[0].n, antes[0].n, 'los rechazos no deben insertar filas');
});

test('los usos viejos se olvidan y los recientes no', async () => {
  await sql`delete from rate_limits where key = ${TEL}`;
  await sql`
    insert into rate_limits (bucket, key, created_at)
    values ('booking', ${TEL}, now() - interval '2 days'),
           ('booking', ${TEL}, now())
  `;

  await purgeOldLimits();

  const quedan = (await sql`select count(*)::int as n from rate_limits where key = ${TEL}`) as { n: number }[];
  assert.equal(quedan[0].n, 1, 'solo debe sobrevivir el reciente');
});

test('la lista de espera no acepta a la misma persona dos veces el mismo día', async () => {
  const biz = (await sql`select id from businesses limit 1`) as { id: string }[];
  if (!biz[0]) return; // base vacía: nada que probar
  const svc = (await sql`select id from services where business_id = ${biz[0].id} limit 1`) as { id: string }[];
  if (!svc[0]) return;

  const fecha = '2099-01-01';   // futuro lejano: no choca con datos reales
  const tel = '+52999TESTDUP';
  await sql`delete from waitlist_entries where customer_phone = ${tel}`;

  const insertar = () => sql`
    insert into waitlist_entries (business_id, service_id, customer_name, customer_phone, date)
    values (${biz[0].id}, ${svc[0].id}, 'dup test', ${tel}, ${fecha}::date)
  `;

  await insertar();
  await assert.rejects(insertar, (e: { code?: string }) => e.code === '23505',
    'el índice único debe rechazar el duplicado, incluso con staff_id NULL');

  await sql`delete from waitlist_entries where customer_phone = ${tel}`;
});

test('la espera de días que ya pasaron se borra, la futura se queda', async () => {
  const biz = (await sql`select id from businesses limit 1`) as { id: string }[];
  if (!biz[0]) return;
  const svc = (await sql`select id from services where business_id = ${biz[0].id} limit 1`) as { id: string }[];
  if (!svc[0]) return;

  const tel = '~+52999TESTPURGA';
  await sql`delete from waitlist_entries where customer_phone like '~+52999TEST%'`;
  await sql`
    insert into waitlist_entries (business_id, service_id, customer_name, customer_phone, date)
    values (${biz[0].id}, ${svc[0].id}, 'vieja', ${tel}, current_date - 1),
           (${biz[0].id}, ${svc[0].id}, 'futura', ${tel}, ${'2099-01-02'}::date)
  `;

  await purgeOldWaitlist();

  const quedan = (await sql`
    select customer_name from waitlist_entries where customer_phone = ${tel}
  `) as { customer_name: string }[];
  assert.deepEqual(quedan.map((r) => r.customer_name), ['futura']);

  await sql`delete from waitlist_entries where customer_phone like '~+52999TEST%'`;
});
