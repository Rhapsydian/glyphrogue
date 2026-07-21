import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlyphMetrics } from '../src/glyphMetrics.js';
import { createPalette } from '../src/palette.js';
import { setLayerFont, drawGlyphCell, drawCellBackground, drawTileCell } from '../src/glyphRenderer.js';

// A fake ctx standing in for CanvasRenderingContext2D - records every
// draw-relevant call (property set or method call) in order, so tests
// assert on the recorded sequence instead of needing a real canvas.
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
    fillRect(x, y, w, h) {
      calls.push({ method: 'fillRect', args: [x, y, w, h] });
    },
    clearRect(x, y, w, h) {
      calls.push({ method: 'clearRect', args: [x, y, w, h] });
    },
    createLinearGradient(x0, y0, x1, y1) {
      const stops = [];
      calls.push({ method: 'createLinearGradient', args: [x0, y0, x1, y1] });
      return {
        stops,
        addColorStop(offset, color) {
          stops.push({ offset, color });
        },
      };
    },
  };
}

test('setLayerFont sets ctx.font once to the expected string', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 16 });

  setLayerFont(ctx, metrics, 'Pixelyph');

  assert.deepEqual(ctx.calls, [{ method: 'set font', args: ['16px Pixelyph'] }]);
});

test('drawGlyphCell sets fillStyle immediately before its fillText call', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, baselineRow: 0.8, horizontalPadding: 0 });

  drawGlyphCell(ctx, metrics, { width: 16, height: 16 }, { col: 2, row: 1, text: '@', color: 'gold' });

  assert.deepEqual(ctx.calls, [
    { method: 'set fillStyle', args: ['gold'] },
    { method: 'fillText', args: ['@', 32, 28.8] },
  ]);
});

test('two calls with different colors each get their own fillStyle set, in order', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 10, baselineRow: 0.5 });
  const cellSize = { width: 10, height: 10 };

  drawGlyphCell(ctx, metrics, cellSize, { col: 0, row: 0, text: '#', color: 'gray' });
  drawGlyphCell(ctx, metrics, cellSize, { col: 1, row: 0, text: '@', color: 'gold' });

  assert.deepEqual(
    ctx.calls.map((c) => c.method),
    ['set fillStyle', 'fillText', 'set fillStyle', 'fillText'],
  );
  assert.equal(ctx.calls[0].args[0], 'gray');
  assert.equal(ctx.calls[2].args[0], 'gold');
});

test('an explicit offsetX/baselineOffsetPx override bypasses the shared-metrics computation', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, baselineRow: 0.8, horizontalPadding: 0 });

  drawGlyphCell(ctx, metrics, { width: 16, height: 16 }, {
    col: 1, row: 0, text: 'e000', color: 'gold', offsetX: 3.2, baselineOffsetPx: 14.4,
  });

  // px = col*width + horizontalPadding + offsetXOverride = 16 + 0 + 3.2 = 19.2; py = 0 + 14.4
  assert.deepEqual(ctx.calls[1].args.slice(1), [19.2, 14.4]);
});

test('pixel position accounts for a per-glyph offsetX', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({
    pixelsPerEm: 16,
    unitsPerEm: 1000,
    baselineRow: 0.8,
    horizontalPadding: 2,
    glyphs: { '@': { advanceWidth: 1000, offsetX: 100 } },
  });

  drawGlyphCell(ctx, metrics, { width: 16, height: 16 }, { col: 0, row: 0, text: '@', color: 'gold' });

  // px = col*width + horizontalPadding + offsetX(scaled) = 0 + 2 + 1.6 = 3.6
  assert.equal(ctx.calls[1].args[1], 3.6);
});

test('drawGlyphCell resolves a { token } color against a palette before setting fillStyle', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, baselineRow: 0.8 });
  const palette = createPalette({ danger: '#c00' });

  drawGlyphCell(ctx, metrics, { width: 16, height: 16 }, { col: 0, row: 0, text: '@', color: { token: 'danger' }, palette });

  assert.equal(ctx.calls[0].args[0], '#c00');
});

test('drawGlyphCell builds a CanvasGradient sized to the cell for a gradient-token color', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, baselineRow: 0.8 });
  const palette = createPalette({
    'wall-stone': { type: 'gradient', stops: [{ offset: 0, color: '#888' }, { offset: 1, color: '#444' }] },
  });

  drawGlyphCell(ctx, metrics, { width: 16, height: 16 }, { col: 1, row: 2, text: '#', color: { token: 'wall-stone' }, palette });

  assert.deepEqual(ctx.calls[0], { method: 'createLinearGradient', args: [16, 32, 16, 48] });
  const gradient = ctx.calls[1].args[0];
  assert.deepEqual(gradient.stops, [{ offset: 0, color: '#888' }, { offset: 1, color: '#444' }]);
});

test('drawGlyphCell without a palette leaves a raw string color untouched (backward compatible)', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, baselineRow: 0.8 });

  drawGlyphCell(ctx, metrics, { width: 16, height: 16 }, { col: 0, row: 0, text: '@', color: 'gold' });

  assert.equal(ctx.calls[0].args[0], 'gold');
});

test('drawCellBackground fills the cell rect with the resolved color', () => {
  const ctx = createFakeCtx();
  const palette = createPalette({ 'floor-bg': '#111' });

  drawCellBackground(ctx, { width: 10, height: 10 }, { col: 2, row: 1 }, { token: 'floor-bg' }, palette);

  assert.deepEqual(ctx.calls, [
    { method: 'set fillStyle', args: ['#111'] },
    { method: 'fillRect', args: [20, 10, 10, 10] },
  ]);
});

test('drawTileCell draws background then glyph when a command carries a background', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 10, baselineRow: 0.5 });
  const palette = createPalette({ 'floor-bg': '#111', mud: '#530' });

  drawTileCell(ctx, metrics, { width: 10, height: 10 }, palette, {
    col: 0, row: 0, text: '.', color: { token: 'mud' }, background: { token: 'floor-bg' },
  });

  assert.deepEqual(
    ctx.calls.map((c) => c.method),
    ['set fillStyle', 'fillRect', 'set fillStyle', 'fillText'],
  );
  assert.equal(ctx.calls[0].args[0], '#111');
  assert.equal(ctx.calls[2].args[0], '#530');
});

test('drawTileCell skips the background draw entirely when the command has none', () => {
  const ctx = createFakeCtx();
  const metrics = createGlyphMetrics({ pixelsPerEm: 10, baselineRow: 0.5 });

  drawTileCell(ctx, metrics, { width: 10, height: 10 }, undefined, { col: 0, row: 0, text: '@', color: 'gold' });

  assert.deepEqual(ctx.calls.map((c) => c.method), ['set fillStyle', 'fillText']);
});
