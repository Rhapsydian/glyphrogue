import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlyphMetrics } from '../src/glyphMetrics.js';
import {
  createFontSourceRegistry,
  registerFontSource,
  getFontSource,
  deriveCalibration,
  calibratedGlyphAdvance,
  calibratedBaselineOffset,
} from '../src/fontSources.js';

test('deriveCalibration is identity (scale 1, baselineOffset 0) with no reference', () => {
  const calibration = deriveCalibration({ unitsPerEm: 1000, ascender: 800, descender: -200 }, null, null);
  assert.equal(calibration.scale, 1);
  assert.equal(calibration.baselineOffset, 0);
  assert.equal(calibration.horizontalCenteringMode, 'advance');
});

test('the first font source registered becomes the implicit reference (scale 1)', () => {
  const fontSources = createFontSourceRegistry();
  registerFontSource(fontSources, 'mono', { unitsPerEm: 1000, ascender: 800, descender: -200 });
  assert.equal(getFontSource(fontSources, 'mono').calibration.scale, 1);
});

test('a second font source calibrates its scale relative to the first (reference)', () => {
  const fontSources = createFontSourceRegistry();
  registerFontSource(fontSources, 'mono', { unitsPerEm: 1000, ascender: 800, descender: -200 });
  // Half the vertical span ratio of the reference -> needs 2x scale to match visually.
  registerFontSource(fontSources, 'pixelyph', { unitsPerEm: 1000, ascender: 400, descender: -100 });
  assert.equal(getFontSource(fontSources, 'pixelyph').calibration.scale, 2);
});

test('an explicit { reference } pins the standard independent of registration order', () => {
  const pixelyphMetrics = { unitsPerEm: 1000, ascender: 400, descender: -100 };
  const fontSources = createFontSourceRegistry({ reference: pixelyphMetrics });

  // Registered first, but the reference was pinned at creation - should NOT become the reference.
  registerFontSource(fontSources, 'mono', { unitsPerEm: 1000, ascender: 800, descender: -200 });
  registerFontSource(fontSources, 'pixelyph', pixelyphMetrics);

  assert.equal(getFontSource(fontSources, 'pixelyph').calibration.scale, 1);
  assert.equal(getFontSource(fontSources, 'mono').calibration.scale, 0.5);
});

test('baselineOffset aligns a differing ascender ratio against the pinned reference', () => {
  const referenceMetrics = { unitsPerEm: 1000, ascender: 800, descender: -200 };
  const fontSources = createFontSourceRegistry({ reference: referenceMetrics });
  registerFontSource(fontSources, 'other', { unitsPerEm: 1000, ascender: 700, descender: -200 });

  // referenceAscenderRatio (0.8) - ownAscenderRatio (0.7) = 0.1
  assert.ok(Math.abs(getFontSource(fontSources, 'other').calibration.baselineOffset - 0.1) < 1e-9);
});

test('options.override lets a game replace a stored calibration and have it persist', () => {
  const fontSources = createFontSourceRegistry();
  registerFontSource(fontSources, 'mono', { unitsPerEm: 1000, ascender: 800, descender: -200 });
  registerFontSource(
    fontSources,
    'mono',
    { unitsPerEm: 1000, ascender: 800, descender: -200 },
    { override: 'mono' },
  );
  const stored = getFontSource(fontSources, 'mono');
  stored.calibration.scale = 1.5;
  assert.equal(getFontSource(fontSources, 'mono').calibration.scale, 1.5);
});

test('calibratedGlyphAdvance scales a source glyph by both its own unitsPerEm and the calibration scale', () => {
  const metrics = createGlyphMetrics({ pixelsPerEm: 16 });
  const sourceMetrics = { unitsPerEm: 2000, glyphs: { e000: { advanceWidth: 2000, offsetX: 200 } } };
  const calibration = { scale: 2, baselineOffset: 0, horizontalCenteringMode: 'advance' };

  const advance = calibratedGlyphAdvance(metrics, sourceMetrics, calibration, 'e000');

  // scale = (16/2000) * 2 = 0.016; advanceWidth = 2000*0.016 = 32; offsetX = 200*0.016 = 3.2
  assert.equal(advance.advanceWidth, 32);
  assert.equal(advance.offsetX, 3.2);
});

test('calibratedBaselineOffset shifts the shared baseline by the calibration ratio', () => {
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, baselineRow: 0.8 });
  const calibration = { scale: 1, baselineOffset: 0.1, horizontalCenteringMode: 'advance' };

  // baselineOffset(metrics) = 12.8; + 0.1*16 = 1.6 -> 14.4
  assert.equal(calibratedBaselineOffset(metrics, calibration), 14.4);
});
