import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFov, fovContains } from '../src/fov.js';

const neverOpaque = () => false;

test('origin cell is always visible', () => {
  const fov = computeFov({ x: 5, y: 5 }, 3, { isOpaque: neverOpaque });
  assert.ok(fovContains(fov, 5, 5));
});

test('open field visibility is bounded by radius (circular)', () => {
  const fov = computeFov({ x: 0, y: 0 }, 3, { isOpaque: neverOpaque });

  assert.ok(fovContains(fov, 3, 0));
  assert.ok(fovContains(fov, 0, 3));
  assert.ok(fovContains(fov, 2, 2));

  assert.ok(!fovContains(fov, 4, 0));
  assert.ok(!fovContains(fov, 3, 3));
});

test('an opaque wall is itself visible but blocks the cells behind it', () => {
  const isOpaque = (x, y) => x === 2 && y === 0;
  const fov = computeFov({ x: 0, y: 0 }, 5, { isOpaque });

  assert.ok(fovContains(fov, 2, 0), 'the wall cell itself should be visible');
  assert.ok(!fovContains(fov, 3, 0), 'directly behind the wall should be blocked');
  assert.ok(!fovContains(fov, 4, 0), 'further behind the wall should be blocked');
});

test('cells not directly shadowed by a wall remain visible', () => {
  const isOpaque = (x, y) => x === 2 && y === 0;
  const fov = computeFov({ x: 0, y: 0 }, 5, { isOpaque });

  assert.ok(fovContains(fov, 2, 2), 'off to the side of the wall should stay visible');
});

test('is deterministic for the same origin/radius/isOpaque', () => {
  const isOpaque = (x, y) => x === 1 && y === 1;
  const a = computeFov({ x: 0, y: 0 }, 4, { isOpaque });
  const b = computeFov({ x: 0, y: 0 }, 4, { isOpaque });

  assert.deepEqual([...a].sort(), [...b].sort());
});

test('a fully enclosed origin sees the enclosing walls but nothing beyond', () => {
  const isOpaque = (x, y) => !(x === 0 && y === 0);
  const fov = computeFov({ x: 0, y: 0 }, 5, { isOpaque });

  // origin + its 8 immediate (wall) neighbors - each wall is itself
  // visible, but none of them let sight through to anything further out.
  assert.equal(fov.size, 9);
  assert.ok(fovContains(fov, 0, 0));
  assert.ok(fovContains(fov, 1, 1));
  assert.ok(!fovContains(fov, 2, 2));
});
