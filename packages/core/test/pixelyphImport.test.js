import test from 'node:test';
import assert from 'node:assert/strict';
import { glyphManifestToFontSource } from '../src/pixelyphImport.js';
import { createFontSourceRegistry, registerFontSource, getFontSource } from '../src/fontSources.js';

function sampleManifest() {
  return {
    meta: {
      familyName: 'GlyphrogueIcons',
      styleName: 'Regular',
      pixelsPerEm: 16,
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      baselineRow: 0.8,
      horizontalPadding: 0,
    },
    glyphs: {
      e000: { codepoint: 'e000', name: 'goblin', slug: 'goblin', advanceWidth: 900, offsetX: 50, width: 16, height: 16 },
      e001: { codepoint: 'e001', name: 'wall', slug: 'wall', advanceWidth: 1000, offsetX: 0, width: 16, height: 16 },
    },
  };
}

test('glyphManifestToFontSource pulls unitsPerEm/ascender/descender from the manifest meta block', () => {
  const sourceMetrics = glyphManifestToFontSource(sampleManifest());
  assert.equal(sourceMetrics.unitsPerEm, 1000);
  assert.equal(sourceMetrics.ascender, 800);
  assert.equal(sourceMetrics.descender, -200);
});

test('glyphManifestToFontSource keeps only advanceWidth/offsetX per glyph, still keyed by hex codepoint', () => {
  const sourceMetrics = glyphManifestToFontSource(sampleManifest());
  assert.deepEqual(sourceMetrics.glyphs.e000, { advanceWidth: 900, offsetX: 50 });
  assert.deepEqual(sourceMetrics.glyphs.e001, { advanceWidth: 1000, offsetX: 0 });
  assert.equal(sourceMetrics.glyphs.e000.name, undefined);
});

test('the transformed sourceMetrics registers directly as a font source', () => {
  const fontSources = createFontSourceRegistry();
  registerFontSource(fontSources, 'pixelyph-icons', glyphManifestToFontSource(sampleManifest()));

  const stored = getFontSource(fontSources, 'pixelyph-icons');
  assert.equal(stored.calibration.scale, 1);
  assert.ok('e000' in stored.sourceMetrics.glyphs);
});
