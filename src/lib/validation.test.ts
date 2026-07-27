import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidSlug, normalizePhoneMX, isUuid } from './validation';

test('slugs válidos pasan', () => {
  for (const s of ['abc', 'belleza-total', 'a12', 'estetica-2', 'x'.repeat(40)]) {
    assert.ok(isValidSlug(s), s);
  }
});

test('rechaza lo más corto que el mínimo documentado (3 caracteres)', () => {
  // El comentario del código dice "3-40 caracteres": si esto pasa con 1 o 2,
  // el regex no hace lo que dice que hace.
  assert.equal(isValidSlug(''), false);
  assert.equal(isValidSlug('a'), false);
  assert.equal(isValidSlug('ab'), false);
  assert.equal(isValidSlug('abc'), true);
});

test('rechaza más de 40 caracteres', () => {
  assert.equal(isValidSlug('x'.repeat(41)), false);
});

test('rechaza guion al inicio o al final', () => {
  assert.equal(isValidSlug('-abc'), false);
  assert.equal(isValidSlug('abc-'), false);
});

test('rechaza mayúsculas, espacios y símbolos', () => {
  for (const s of ['Abc', 'ab c', 'abc_def', 'año-nuevo', 'abc.mx']) {
    assert.equal(isValidSlug(s), false, s);
  }
});

test('rechaza las rutas reales de la app como slug', () => {
  // Si un negocio se registra con uno de estos, su página pública queda
  // inalcanzable detrás de la ruta de verdad para siempre.
  for (const s of ['api', 'c', 'entrar', 'panel', 'superadmin']) {
    assert.equal(isValidSlug(s), false, s);
  }
});

test('normalizePhoneMX y isUuid siguen intactos (regresión)', () => {
  assert.equal(normalizePhoneMX('961 123 4567'), '+529611234567');
  assert.equal(normalizePhoneMX('123'), null);
  assert.equal(isUuid('6d236cf1-2a49-416b-9517-c7410779ec60'), true);
  assert.equal(isUuid('no-uuid'), false);
});
