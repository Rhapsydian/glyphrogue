import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from '@glyphrogue/core';
import {
  pixelToWorldCell,
  normalizeMarqueeBounds,
  clampBoundsToZone,
  snapshotRegion,
  patchRegionIntoZone,
} from '../src/pinRegion.js';

function makeZone(width, height, fill, entities = []) {
  return { width, height, cells: new Array(width * height).fill(fill), entities, anchors: [], logicalLinks: [] };
}

test('pixelToWorldCell converts a raw canvas pixel to a world cell via the real screenToWorld, honoring a non-identity camera', () => {
  const camera = createCamera({ x: 5, y: 2, viewportWidth: 20, viewportHeight: 12 });
  const cellSize = { width: 16, height: 16 };
  // pixel (33, 17) -> canvas col/row (2, 1) -> world (2+5, 1+2)
  assert.deepEqual(pixelToWorldCell(33, 17, cellSize, camera), { x: 7, y: 3 });
});

test('normalizeMarqueeBounds handles both drag directions and is inclusive of both corners', () => {
  assert.deepEqual(normalizeMarqueeBounds({ x: 2, y: 3 }, { x: 5, y: 6 }), { x: 2, y: 3, width: 4, height: 4 });
  assert.deepEqual(normalizeMarqueeBounds({ x: 5, y: 6 }, { x: 2, y: 3 }), { x: 2, y: 3, width: 4, height: 4 });
  // A single-cell drag pins exactly one cell, not zero.
  assert.deepEqual(normalizeMarqueeBounds({ x: 4, y: 4 }, { x: 4, y: 4 }), { x: 4, y: 4, width: 1, height: 1 });
});

test('clampBoundsToZone intersects a marquee against the zone, including a fully out-of-range drag', () => {
  const zone = makeZone(10, 10, 'floor');
  assert.deepEqual(clampBoundsToZone({ x: -3, y: -3, width: 6, height: 6 }, zone), { x: 0, y: 0, width: 3, height: 3 });
  assert.deepEqual(clampBoundsToZone({ x: 8, y: 8, width: 6, height: 6 }, zone), { x: 8, y: 8, width: 2, height: 2 });
  // Fully out of range: the intersection is empty (width/height 0) - x/y in
  // that case just reflect max(0, bounds.x/y), since an empty rect's
  // position is otherwise moot.
  assert.deepEqual(clampBoundsToZone({ x: 20, y: 20, width: 2, height: 2 }, zone), { x: 20, y: 20, width: 0, height: 0 });
});

test('snapshotRegion + patchRegionIntoZone: a pinned region, including an entity inside it, survives a reroll of an otherwise-different zone', () => {
  const original = makeZone(4, 4, 'wall', [{ type: 'chest', x: 1, y: 1, data: {} }]);
  const bounds = { x: 0, y: 0, width: 2, height: 2 };
  const snapshot = snapshotRegion(original, bounds);

  const rerolled = makeZone(4, 4, 'floor', [{ type: 'goblin', x: 3, y: 3, data: {} }]);
  const patched = patchRegionIntoZone(rerolled, snapshot);

  // Inside the pinned region: original 'wall' cells and the chest survive.
  assert.equal(patched.cells[0 * 4 + 0], 'wall');
  assert.equal(patched.cells[1 * 4 + 1], 'wall');
  assert.ok(patched.entities.some((e) => e.type === 'chest' && e.x === 1 && e.y === 1));

  // Outside the pinned region: the fresh reroll's own content survives untouched.
  assert.equal(patched.cells[3 * 4 + 3], 'floor');
  assert.ok(patched.entities.some((e) => e.type === 'goblin' && e.x === 3 && e.y === 3));
});

test('patchRegionIntoZone removes any entity the fresh reroll placed inside the pinned bounds, so it does not leak through alongside the pinned one', () => {
  const original = makeZone(3, 3, 'wall', [{ type: 'chest', x: 0, y: 0, data: {} }]);
  const bounds = { x: 0, y: 0, width: 2, height: 2 };
  const snapshot = snapshotRegion(original, bounds);

  const rerolled = makeZone(3, 3, 'floor', [{ type: 'goblin', x: 1, y: 1, data: {} }]);
  const patched = patchRegionIntoZone(rerolled, snapshot);

  assert.equal(patched.entities.length, 1);
  assert.equal(patched.entities[0].type, 'chest');
});

test('patchRegionIntoZone safely drops out-of-range cells/entities when patched into a smaller zone (pin + generator/dimension switch)', () => {
  const original = makeZone(6, 6, 'wall', [{ type: 'chest', x: 4, y: 4, data: {} }]);
  const bounds = { x: 3, y: 3, width: 3, height: 3 };
  const snapshot = snapshotRegion(original, bounds);

  const smallerRerolled = makeZone(4, 4, 'floor');
  const patched = patchRegionIntoZone(smallerRerolled, snapshot);

  // Nothing should throw or write out of range; only the in-range corner survives.
  assert.equal(patched.cells.length, 16);
  assert.equal(patched.cells[3 * 4 + 3], 'wall');
  assert.equal(patched.entities.length, 0);
});
