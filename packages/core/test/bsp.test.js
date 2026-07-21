import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { createZone, ensureTraversable } from '../src/zoneComposition.js';
import { carveBsp, bspGenerator } from '../src/bsp.js';

test('bspGenerator is deterministic for a given seed', () => {
  const a = bspGenerator({ rng: createRng(1), params: { width: 30, height: 20 } });
  const b = bspGenerator({ rng: createRng(1), params: { width: 30, height: 20 } });

  assert.deepEqual(a.cells, b.cells);
});

test('bspGenerator produces a different layout for a different seed', () => {
  const a = bspGenerator({ rng: createRng(1), params: { width: 30, height: 20 } });
  const b = bspGenerator({ rng: createRng(2), params: { width: 30, height: 20 } });

  assert.notDeepEqual(a.cells, b.cells);
});

test('bspGenerator throws when width/height are missing', () => {
  assert.throws(() => bspGenerator({ rng: createRng(1), params: {} }));
});

test('every room carveBsp generates is reachable from its own entry point', () => {
  const zone = createZone(30, 20);
  const { entryPoint } = carveBsp(zone, createRng(3), {});
  const before = zone.cells.slice();

  ensureTraversable(zone, { entryPoints: [entryPoint], mode: 'prune' });

  assert.deepEqual(zone.cells, before);
});

test('minPartitionSize prevents any split when the zone is too small to satisfy it', () => {
  const zone = createZone(10, 10);
  const { rooms } = carveBsp(zone, createRng(1), { minPartitionSize: 6 });

  assert.equal(rooms.length, 1);
});

test('minPartitionSize allows a split once the zone is large enough', () => {
  const zone = createZone(20, 10);
  const { rooms } = carveBsp(zone, createRng(1), { minPartitionSize: 6 });

  assert.ok(rooms.length >= 2);
});

test('carveBsp only carves within the given region, leaving the rest of the zone untouched', () => {
  const zone = createZone(20, 10, 'untouched');
  carveBsp(zone, createRng(1), { region: { x: 0, y: 0, width: 10, height: 10 } });

  for (let y = 0; y < 10; y++) {
    for (let x = 10; x < 20; x++) {
      assert.equal(zone.cells[y * 20 + x], 'untouched');
    }
  }
});

test('bspGenerator auto-connects a stamp placed away from any generated room', () => {
  const template = { width: 1, height: 1, cells: ['floor'], entities: [], anchors: [], logicalLinks: [] };
  const zone = bspGenerator({
    rng: createRng(4),
    params: { width: 30, height: 20, stamps: [{ template, x: 0, y: 0 }] },
  });

  const entryAnchor = zone.anchors.find((a) => a.id === 'entry');
  const reached = ensureTraversable(zone, { entryPoints: [entryAnchor], mode: 'prune' });

  assert.equal(zone.cells[0], 'floor');
  assert.ok(reached.has('0,0'));
});
