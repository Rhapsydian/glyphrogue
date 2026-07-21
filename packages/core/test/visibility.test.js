import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_TONE,
  classifyVisibility,
  updateRemembered,
  computeLighting,
  cellRenderState,
  updateLastKnownLight,
} from '../src/visibility.js';

const neverOpaque = () => false;

test('classifyVisibility: the three disjoint cases', () => {
  const currentFov = new Set(['0,0']);
  const remembered = new Set(['1,0']);

  assert.equal(classifyVisibility(currentFov, remembered, 0, 0), 'visible');
  assert.equal(classifyVisibility(currentFov, remembered, 1, 0), 'remembered');
  assert.equal(classifyVisibility(currentFov, remembered, 9, 9), 'unknown');
});

test('updateRemembered does not mutate the input and returns the union', () => {
  const remembered = new Set(['0,0']);
  const currentFov = new Set(['1,0', '2,0']);

  const next = updateRemembered(remembered, currentFov);

  assert.deepEqual(remembered, new Set(['0,0']));
  assert.deepEqual([...next].sort(), ['0,0', '1,0', '2,0']);
});

test('computeLighting blends two overlapping sources at a shared cell', () => {
  const sources = [
    { origin: { x: 0, y: 0 }, radius: 3, color: 'red', intensity: 5 },
    { origin: { x: 2, y: 0 }, radius: 3, color: 'blue', intensity: 10 },
  ];
  const lightMap = computeLighting(sources, { isOpaque: neverOpaque });

  const shared = lightMap.get('1,0');
  assert.equal(shared.level, 15);
  assert.equal(shared.color, 'blue', 'higher-intensity source wins the color');
});

test('computeLighting returns nothing for a cell no source reaches', () => {
  const sources = [{ origin: { x: 0, y: 0 }, radius: 1, color: 'red', intensity: 5 }];
  const lightMap = computeLighting(sources, { isOpaque: neverOpaque });
  assert.equal(lightMap.get('50,50'), undefined);
});

test('computeLighting is blocked by opaque cells same as fov', () => {
  const isOpaque = (x, y) => x === 1 && y === 0;
  const sources = [{ origin: { x: 0, y: 0 }, radius: 5, color: 'red', intensity: 5 }];
  const lightMap = computeLighting(sources, { isOpaque });
  assert.equal(lightMap.get('3,0'), undefined);
});

test('cellRenderState returns MEMORY_TONE for a remembered cell by default', () => {
  const state = cellRenderState(
    { x: 1, y: 0 },
    {
      currentFov: new Set(),
      remembered: new Set(['1,0']),
      lastKnownLight: new Map([['1,0', { level: 8, color: 'orange' }]]),
      lightMap: new Map(),
      preserveLastKnownLight: false,
    },
  );
  assert.equal(state.classification, 'remembered');
  assert.equal(state.light, MEMORY_TONE);
});

test('cellRenderState returns stored last-known light when preserveLastKnownLight is true', () => {
  const state = cellRenderState(
    { x: 1, y: 0 },
    {
      currentFov: new Set(),
      remembered: new Set(['1,0']),
      lastKnownLight: new Map([['1,0', { level: 8, color: 'orange' }]]),
      lightMap: new Map(),
      preserveLastKnownLight: true,
    },
  );
  assert.deepEqual(state.light, { level: 8, color: 'orange' });
});

test('cellRenderState returns null light for an unknown cell', () => {
  const state = cellRenderState(
    { x: 9, y: 9 },
    { currentFov: new Set(), remembered: new Set(), lastKnownLight: new Map(), lightMap: new Map() },
  );
  assert.equal(state.classification, 'unknown');
  assert.equal(state.light, null);
});

test('updateLastKnownLight leaves out-of-fov entries untouched', () => {
  const lastKnownLight = new Map([['5,5', { level: 3, color: 'green' }]]);
  const currentFov = new Set(['0,0']);
  const lightMap = new Map([['0,0', { level: 9, color: 'white' }]]);

  const next = updateLastKnownLight(lastKnownLight, currentFov, lightMap);

  assert.deepEqual(next.get('5,5'), { level: 3, color: 'green' });
  assert.deepEqual(next.get('0,0'), { level: 9, color: 'white' });
});
