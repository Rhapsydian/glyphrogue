import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { createZone, carveCellularAutomata, ensureTraversable } from '../src/zoneComposition.js';
import { cellularAutomataGenerator } from '../src/cellularAutomataGenerator.js';

test('cellularAutomataGenerator is deterministic for a given seed', () => {
  const a = cellularAutomataGenerator({ rng: createRng(1), params: { width: 20, height: 20 } });
  const b = cellularAutomataGenerator({ rng: createRng(1), params: { width: 20, height: 20 } });

  assert.deepEqual(a.cells, b.cells);
});

test('cellularAutomataGenerator produces a different result for a different seed', () => {
  const a = cellularAutomataGenerator({ rng: createRng(1), params: { width: 20, height: 20 } });
  const b = cellularAutomataGenerator({ rng: createRng(2), params: { width: 20, height: 20 } });

  assert.notDeepEqual(a.cells, b.cells);
});

test('cellularAutomataGenerator throws when width/height are missing', () => {
  assert.throws(() => cellularAutomataGenerator({ rng: createRng(1), params: {} }));
});

test('cellularAutomataGenerator prunes all disconnected pockets by default', () => {
  const zone = cellularAutomataGenerator({ rng: createRng(9), params: { width: 25, height: 25 } });
  const before = zone.cells.slice();

  const entry = zone.anchors.find((a) => a.id === 'entry');
  ensureTraversable(zone, { entryPoints: [entry], mode: 'prune' });

  assert.deepEqual(zone.cells, before);
});

test('pruneUnreachable: false leaves the raw carve untouched', () => {
  const seed = 7;
  const zone = cellularAutomataGenerator({
    rng: createRng(seed),
    params: { width: 20, height: 20, pruneUnreachable: false },
  });

  const raw = createZone(20, 20);
  carveCellularAutomata(raw, createRng(seed));

  assert.deepEqual(zone.cells, raw.cells);
});

test('a mayBeIsolated stamp survives pruning even on an all-wall carve', () => {
  const template = { width: 1, height: 1, cells: ['floor'], entities: [], anchors: [], logicalLinks: [] };
  const zone = cellularAutomataGenerator({
    rng: createRng(1),
    params: {
      width: 20,
      height: 20,
      fillProbability: 1,
      stamps: [{ template, x: 10, y: 10, mayBeIsolated: true }],
    },
  });

  assert.equal(zone.cells[10 * 20 + 10], 'floor');
});
