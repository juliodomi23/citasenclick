/**
 * Guardián de la convención de migraciones. No toca la base: solo compara los
 * archivos `db/NNN-*.sql` con lo que `schema.sql` declara como baseline.
 *
 * Existe porque el modo de fallar es silencioso: alguien agrega una migración,
 * olvida registrarla, y meses después nadie sabe qué se aplicó. Eso ya pasó
 * (producción con dos migraciones de atraso, ver db/009).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const migraciones = readdirSync('db')
  .filter((f) => /^\d{3}-.*\.sql$/.test(f))
  .sort();

const schema = readFileSync('db/schema.sql', 'utf8');

test('hay migraciones que revisar', () => {
  assert.ok(migraciones.length > 0, 'no se encontró ningún db/NNN-*.sql');
});

test('cada migración está en el baseline de schema.sql', () => {
  const faltan = migraciones.filter((f) => !schema.includes(`'${f}'`));
  assert.deepEqual(
    faltan, [],
    'una base nueva se crea desde schema.sql y nace con el baseline registrado.\n' +
    'Si una migración no está en esa lista, el runner intentaría aplicarla sobre\n' +
    'una base que ya la tiene. Agrega su nombre al insert de schema_migrations.'
  );
});

/**
 * La convención de auto-registro nace con la 009 (la que crea la tabla). Las
 * 001..008 ya estaban aplicadas en local y producción antes de que existiera el
 * registro; la 009 las da de alta como baseline. Retrofitear un insert en ellas
 * no serviría: nadie las va a volver a correr.
 */
const PRIMERA_CON_REGISTRO = 9;

test('cada migración nueva se registra a sí misma al final', () => {
  const sinRegistrar = migraciones
    .filter((f) => Number(f.slice(0, 3)) >= PRIMERA_CON_REGISTRO)
    .filter((f) => !readFileSync(`db/${f}`, 'utf8').includes(`'${f}'`));

  assert.deepEqual(
    sinRegistrar, [],
    'cada db/NNN-*.sql debe terminar con:\n' +
    "  insert into schema_migrations (filename) values ('NNN-nombre.sql');\n" +
    'sin eso, aplicarla dos veces pasa callada en vez de tronar.'
  );
});

test('la numeración no se repite ni se salta', () => {
  const numeros = migraciones.map((f) => Number(f.slice(0, 3)));
  const esperados = Array.from({ length: numeros.length }, (_, i) => i + 1);
  assert.deepEqual(
    numeros, esperados,
    'dos migraciones con el mismo número se aplican en orden indefinido; un hueco\n' +
    'suele significar que a alguien se le quedó un archivo sin commitear.'
  );
});
