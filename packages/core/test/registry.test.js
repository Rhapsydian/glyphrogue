import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, register, get, has, getOrderedIds } from '../src/registry.js';

test('register/get/has round trip', () => {
  const registry = createRegistry();
  register(registry, 'a', { value: 1 });

  assert.equal(has(registry, 'a'), true);
  assert.deepEqual(get(registry, 'a'), { value: 1 });
  assert.equal(has(registry, 'b'), false);
});

test('duplicate id without override throws', () => {
  const registry = createRegistry();
  register(registry, 'a', { value: 1 });

  assert.throws(() => register(registry, 'a', { value: 2 }));
});

test('override matching id and existing entry replaces it', () => {
  const registry = createRegistry();
  register(registry, 'a', { value: 1 });
  register(registry, 'a', { value: 2 }, { override: 'a' });

  assert.deepEqual(get(registry, 'a'), { value: 2 });
});

test('override matching id but nothing registered throws', () => {
  const registry = createRegistry();

  assert.throws(() => register(registry, 'a', { value: 1 }, { override: 'a' }));
});

test('override mismatching id throws regardless of registry state', () => {
  const registry = createRegistry();

  assert.throws(() => register(registry, 'a', { value: 1 }, { override: 'b' }));

  register(registry, 'a', { value: 1 });
  assert.throws(() => register(registry, 'a', { value: 2 }, { override: 'b' }));
});

test('dependsOn reorders getOrderedIds, even when registered out of order', () => {
  const registry = createRegistry();
  // 'b' is registered first but declares a dependency on 'a', registered
  // after — a forward reference. This is the whole point of dependsOn:
  // registration order (e.g. plugin load order) doesn't have to match
  // dependency order.
  register(registry, 'b', {}, { dependsOn: ['a'] });
  register(registry, 'a', {});

  const order = getOrderedIds(registry);
  assert.ok(order.indexOf('a') < order.indexOf('b'));
});

test('a dependency cycle throws when the order is resolved', () => {
  const registry = createRegistry();
  register(registry, 'a', {}, { dependsOn: ['b'] });
  register(registry, 'b', {}, { dependsOn: ['a'] });

  assert.throws(() => getOrderedIds(registry));
});

test('dependsOn naming a never-registered id throws when the order is resolved', () => {
  const registry = createRegistry();
  register(registry, 'a', {}, { dependsOn: ['nonexistent'] });

  assert.throws(() => getOrderedIds(registry));
});
