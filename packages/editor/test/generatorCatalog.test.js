import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, register } from '@glyphrogue/core';
import { listGeneratorIds } from '../src/generatorCatalog.js';

// registerGenerator (mapgen.js) isn't on @glyphrogue/core's public surface
// (only api.registerGenerator, a bound wrapper, is) - register() directly
// with the exact { generatorFn, paramsDefaults } shape mapgen.js's
// registerGenerator itself builds mirrors it without needing an api instance.

test('listGeneratorIds returns only generator-shaped entries, in registration order', () => {
  const registry = createRegistry();
  register(registry, 'bsp', { generatorFn: () => {}, paramsDefaults: { minPartitionSize: 6 } });
  register(registry, 'some-rule', { ruleFn: () => {} });
  register(registry, 'cellular-automata', { generatorFn: () => {} });

  assert.deepEqual(listGeneratorIds(registry), ['bsp', 'cellular-automata']);
});

test('listGeneratorIds excludes non-generator entries that happen to share a key name', () => {
  const registry = createRegistry();
  register(registry, 'decoy', { paramsDefaults: { x: 1 } });
  register(registry, 'wfc', { generatorFn: () => {}, paramsDefaults: { maxRetries: 50 } });

  assert.deepEqual(listGeneratorIds(registry), ['wfc']);
});

test('listGeneratorIds returns an empty array for a registry with no generators', () => {
  const registry = createRegistry();
  register(registry, 'some-rule', { ruleFn: () => {} });

  assert.deepEqual(listGeneratorIds(registry), []);
});
