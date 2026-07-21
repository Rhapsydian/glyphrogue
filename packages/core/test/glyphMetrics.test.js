import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlyphMetrics, cellSize, glyphAdvance, baselineOffset, fontSizePx } from '../src/glyphMetrics.js';

test('cellSize uses pixelsPerEm for both dimensions', () => {
  const metrics = createGlyphMetrics({ pixelsPerEm: 16 });
  assert.deepEqual(cellSize(metrics), { width: 16, height: 16 });
});

test('glyphAdvance falls back to fallbackAdvanceWidth/offsetX:0 for an unlisted codepoint', () => {
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, unitsPerEm: 1000 });
  assert.deepEqual(glyphAdvance(metrics, '0041'), { advanceWidth: 16, offsetX: 0 });
});

test('glyphAdvance returns a scaled per-glyph override when present', () => {
  const metrics = createGlyphMetrics({
    pixelsPerEm: 16,
    unitsPerEm: 1000,
    glyphs: { '0041': { advanceWidth: 500, offsetX: 50 } },
  });
  assert.deepEqual(glyphAdvance(metrics, '0041'), { advanceWidth: 8, offsetX: 0.8 });
});

test('baselineOffset computes pixelsPerEm * baselineRow', () => {
  const metrics = createGlyphMetrics({ pixelsPerEm: 20, baselineRow: 0.8 });
  assert.equal(baselineOffset(metrics), 16);
});

test('fontSizePx returns pixelsPerEm', () => {
  const metrics = createGlyphMetrics({ pixelsPerEm: 24 });
  assert.equal(fontSizePx(metrics), 24);
});

test('the metrics object is plain data - the one shared source both render paths read', () => {
  const metrics = createGlyphMetrics({ pixelsPerEm: 16 });
  assert.equal(metrics.constructor, Object);
  assert.deepEqual(JSON.parse(JSON.stringify(metrics)).pixelsPerEm, 16);
});
