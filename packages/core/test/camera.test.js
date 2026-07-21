import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCamera,
  updateCamera,
  worldToScreen,
  screenToWorld,
  screenToCanvasPixel,
  worldToCanvasPixel,
  isInViewport,
} from '../src/camera.js';

test('no-op for small movement within the deadzone margin', () => {
  const camera = createCamera({ x: 10, y: 10, viewportWidth: 20, viewportHeight: 20 });
  // world (20,20) -> screen (10,10), well inside [3, 16] on both axes
  const next = updateCamera(camera, { x: 20, y: 20 }, { deadzone: 3 });
  assert.deepEqual(next, camera);
});

test('snaps by exactly the overshoot when the subject exits the deadzone on x', () => {
  const camera = createCamera({ x: 10, y: 10, viewportWidth: 20, viewportHeight: 20 });
  // world (11,20) -> screen (1,10); minCol = 3, overshoot = 3-1 = 2
  const next = updateCamera(camera, { x: 11, y: 20 }, { deadzone: 3 });
  assert.equal(next.x, 8);
  assert.equal(next.y, 10);
});

test('snaps by exactly the overshoot when the subject exits the deadzone on y', () => {
  const camera = createCamera({ x: 10, y: 10, viewportWidth: 20, viewportHeight: 20 });
  // world (20,29) -> screen (10,19); maxRow = 20-1-3 = 16, overshoot = 19-16 = 3
  const next = updateCamera(camera, { x: 20, y: 29 }, { deadzone: 3 });
  assert.equal(next.x, 10);
  assert.equal(next.y, 13);
});

test('clamps to map bounds on both axes', () => {
  const camera = createCamera({ x: 0, y: 0, viewportWidth: 20, viewportHeight: 20 });
  // subject far past the low edge - camera would want to go negative
  const next = updateCamera(camera, { x: 0, y: 0 }, { deadzone: 3, mapWidth: 30, mapHeight: 30 });
  assert.equal(next.x, 0);
  assert.equal(next.y, 0);

  // subject far past the high edge - camera would want to exceed mapSize - viewportSize
  const camera2 = createCamera({ x: 5, y: 5, viewportWidth: 20, viewportHeight: 20 });
  const next2 = updateCamera(camera2, { x: 29, y: 29 }, { deadzone: 3, mapWidth: 30, mapHeight: 30 });
  assert.equal(next2.x, 10); // mapWidth(30) - viewportWidth(20)
  assert.equal(next2.y, 10);
});

test('worldToScreen and screenToWorld are inverses', () => {
  const camera = createCamera({ x: 7, y: 4, viewportWidth: 20, viewportHeight: 20 });
  const screen = worldToScreen(camera, 15, 9);
  const world = screenToWorld(camera, screen.col, screen.row);
  assert.deepEqual(world, { x: 15, y: 9 });
});

test('worldToCanvasPixel composes worldToScreen and screenToCanvasPixel', () => {
  const camera = createCamera({ x: 2, y: 3, viewportWidth: 20, viewportHeight: 20 });
  const cellSize = { width: 16, height: 16 };
  assert.deepEqual(worldToCanvasPixel(camera, 5, 6, cellSize), screenToCanvasPixel(3, 3, cellSize));
  assert.deepEqual(worldToCanvasPixel(camera, 5, 6, cellSize), { px: 48, py: 48 });
});

test('isInViewport excludes the exact boundary cell', () => {
  const camera = createCamera({ x: 0, y: 0, viewportWidth: 10, viewportHeight: 10 });
  assert.ok(isInViewport(camera, 0, 0));
  assert.ok(isInViewport(camera, 9, 9));
  assert.ok(!isInViewport(camera, 10, 0));
  assert.ok(!isInViewport(camera, 0, 10));
  assert.ok(!isInViewport(camera, -1, 0));
});
