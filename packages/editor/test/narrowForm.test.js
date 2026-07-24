import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferFieldType, buildFieldSpecs } from '../src/narrowForm.js';

test('inferFieldType infers number/boolean/string purely from typeof', () => {
  assert.equal(inferFieldType(6), 'number');
  assert.equal(inferFieldType(true), 'boolean');
  assert.equal(inferFieldType('hello'), 'string');
});

test('buildFieldSpecs derives field specs from a flat defaults object, preserving key order', () => {
  const specs = buildFieldSpecs({ minPartitionSize: 6, roomMargin: 1 });
  assert.deepEqual(specs, [
    { key: 'minPartitionSize', type: 'number', defaultValue: 6 },
    { key: 'roomMargin', type: 'number', defaultValue: 1 },
  ]);
});

test('buildFieldSpecs against the real bspPlugin paramsDefaults shape', () => {
  // Mirrors packages/core/src/generatorPlugins.js's bspPlugin registration
  // ({ minPartitionSize: DEFAULT_MIN_PARTITION_SIZE, roomMargin: DEFAULT_ROOM_MARGIN }).
  const bspParamsDefaults = { minPartitionSize: 6, roomMargin: 1 };
  const specs = buildFieldSpecs(bspParamsDefaults);
  assert.equal(specs.length, 2);
  assert.ok(specs.every((spec) => spec.type === 'number'));
});

test("buildFieldSpecs against audioSettings.js's flat mix-settings shape", () => {
  const defaults = { master: 1, music: 0.7, sfx: 0.7 };
  const specs = buildFieldSpecs(defaults);
  assert.deepEqual(specs.map((spec) => spec.key), ['master', 'music', 'sfx']);
  assert.ok(specs.every((spec) => spec.type === 'number'));
});
