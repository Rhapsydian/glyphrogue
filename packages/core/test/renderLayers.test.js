import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from '../src/camera.js';
import { createAnimationState, startTween } from '../src/animation.js';
import { createGlyphMetrics } from '../src/glyphMetrics.js';
import {
  createLayerState,
  terrainLayerDirty,
  markTerrainClean,
  terrainDrawCommands,
  entityDrawCommands,
  paintLayer,
} from '../src/renderLayers.js';

function createFakeCtx() {
  const calls = [];
  return {
    calls,
    set font(value) {
      calls.push({ method: 'set font', args: [value] });
    },
    set fillStyle(value) {
      calls.push({ method: 'set fillStyle', args: [value] });
    },
    fillText(text, x, y) {
      calls.push({ method: 'fillText', args: [text, x, y] });
    },
    clearRect(x, y, w, h) {
      calls.push({ method: 'clearRect', args: [x, y, w, h] });
    },
  };
}

test('terrainLayerDirty is true on first call, false when unchanged, true when a field changes', () => {
  const state = createLayerState();
  const key = { originX: 0, originY: 0, mapVersion: 1 };

  assert.ok(terrainLayerDirty(state, key), 'dirty on first call');
  markTerrainClean(state, key);
  assert.ok(!terrainLayerDirty(state, key), 'clean once marked with the same key');

  assert.ok(terrainLayerDirty(state, { ...key, originX: 1 }), 'dirty when originX changes');
  assert.ok(terrainLayerDirty(state, { ...key, mapVersion: 2 }), 'dirty when mapVersion changes');
});

test('terrainDrawCommands covers every viewport cell in order, skipping null cells', () => {
  const camera = createCamera({ x: 0, y: 0, viewportWidth: 2, viewportHeight: 2 });
  const cellQuery = (x, y) => (x === 1 && y === 1 ? null : { text: '.', color: 'gray' });

  const commands = terrainDrawCommands(camera, cellQuery);

  assert.equal(commands.length, 3);
  assert.deepEqual(
    commands.map((c) => [c.col, c.row]),
    [[0, 0], [1, 0], [0, 1]],
  );
});

test('entityDrawCommands excludes an off-viewport entity', () => {
  const camera = createCamera({ x: 0, y: 0, viewportWidth: 5, viewportHeight: 5 });
  const animationState = createAnimationState();
  const entities = [
    { entity: 'in-view', position: { x: 2, y: 2 }, text: 'g', color: 'green' },
    { entity: 'off-view', position: { x: 20, y: 20 }, text: 'g', color: 'green' },
  ];

  const commands = entityDrawCommands(camera, entities, animationState, 1000);

  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0], { col: 2, row: 2, text: 'g', color: 'green' });
});

test('entityDrawCommands resolves a mid-tween entity via tweenedPosition, not its raw model position', () => {
  const camera = createCamera({ x: 0, y: 0, viewportWidth: 20, viewportHeight: 20 });
  const animationState = createAnimationState();
  startTween(animationState, 'goblin', { from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, durationMs: 100, startTime: 1000 });

  const entities = [{ entity: 'goblin', position: { x: 10, y: 0 }, text: 'g', color: 'green' }];
  const commands = entityDrawCommands(camera, entities, animationState, 1050);

  assert.deepEqual(commands[0], { col: 5, row: 0, text: 'g', color: 'green' });
});

test('paintLayer against the fake ctx: clearRect once, then fillStyle+fillText pairs per command', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 10, baselineRow: 0.5 });
  const cellSize = { width: 10, height: 10 };
  const commands = [
    { col: 0, row: 0, text: '#', color: 'gray' },
    { col: 1, row: 0, text: '@', color: 'gold' },
  ];

  paintLayer(ctx, metrics, cellSize, 'Pixelyph', commands, { clear: true, viewportPixelWidth: 100, viewportPixelHeight: 100 });

  assert.deepEqual(
    ctx.calls.map((c) => c.method),
    ['set font', 'clearRect', 'set fillStyle', 'fillText', 'set fillStyle', 'fillText'],
  );
  assert.deepEqual(ctx.calls[1].args, [0, 0, 100, 100]);
});

test('paintLayer skips clearRect when clear is false', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 10, baselineRow: 0.5 });

  paintLayer(ctx, metrics, { width: 10, height: 10 }, 'Pixelyph', [], { clear: false });

  assert.deepEqual(ctx.calls.map((c) => c.method), ['set font']);
});
