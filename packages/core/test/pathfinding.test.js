import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath } from '../src/pathfinding.js';

const alwaysWalkable = () => true;

test('returns an empty path when already at the destination', () => {
  const path = findPath({ x: 2, y: 2 }, { x: 2, y: 2 }, { isWalkable: alwaysWalkable });
  assert.deepEqual(path, []);
});

test('finds the shortest path across an open grid', () => {
  const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, { isWalkable: alwaysWalkable });
  assert.equal(path.length, 3);
  assert.deepEqual(path[path.length - 1], { x: 3, y: 0 });
});

test('routes around a wall blocking the direct line', () => {
  // A vertical wall at x=2 for y=-2..2, with a single gap at y=3, forces a
  // detour longer than the 4-step Manhattan distance.
  const isWalkable = (x, y) => !(x === 2 && y !== 3);
  const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, { isWalkable });

  assert.ok(path, 'a path should exist through the gap');
  assert.ok(path.length > 4, 'detouring through the gap costs more than the direct distance');
  for (const { x, y } of path) {
    assert.ok(isWalkable(x, y), `step (${x},${y}) must be walkable`);
  }
  assert.deepEqual(path[path.length - 1], { x: 4, y: 0 });
});

test('returns null when the destination is unreachable', () => {
  // A bounded 10x10 map (out-of-bounds counts as unwalkable, same
  // convention zoneComposition.js's isWalkableCell uses) with a wall at
  // x=5 spanning the full height - no detour fits within bounds.
  const isWalkable = (x, y) => {
    if (x < 0 || x >= 10 || y < 0 || y >= 10) return false;
    return x !== 5;
  };
  const path = findPath({ x: 0, y: 0 }, { x: 9, y: 0 }, { isWalkable });
  assert.equal(path, null);
});

test('returns null when the destination cell itself is not walkable', () => {
  const isWalkable = (x, y) => !(x === 3 && y === 0);
  const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, { isWalkable });
  assert.equal(path, null);
});

test('never steps onto a non-walkable cell', () => {
  const walls = new Set(['1,0', '1,1', '0,1']);
  const isWalkable = (x, y) => !walls.has(`${x},${y}`);
  const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, { isWalkable });

  assert.ok(path);
  for (const { x, y } of path) {
    assert.ok(!walls.has(`${x},${y}`));
  }
});
