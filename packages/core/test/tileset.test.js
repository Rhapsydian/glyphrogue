import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlyphMetrics } from '../src/glyphMetrics.js';
import { createFontSourceRegistry, registerFontSource } from '../src/fontSources.js';
import { createTileset, registerSymbol, resolveSymbol } from '../src/tileset.js';

function setup() {
  const metrics = createGlyphMetrics({ pixelsPerEm: 16, baselineRow: 0.8 });
  const fontSources = createFontSourceRegistry();
  registerFontSource(fontSources, 'mono', { unitsPerEm: 1000, ascender: 800, descender: -200 });
  return { metrics, fontSources };
}

test('resolveSymbol converts a hex codepoint to its drawable character', () => {
  const { metrics, fontSources } = setup();
  const tileset = createTileset();
  registerSymbol(tileset, 'wall', { fontFace: 'mono', codepoint: '40', foreground: 'gray' });

  const resolved = resolveSymbol(tileset, fontSources, metrics, 'wall');

  assert.equal(resolved.text, '@');
});

test('resolveSymbol carries the symbol\'s foreground/background tokens through unresolved', () => {
  const { metrics, fontSources } = setup();
  const tileset = createTileset();
  registerSymbol(tileset, 'danger-floor', {
    fontFace: 'mono',
    codepoint: '2e',
    foreground: { token: 'danger' },
    background: { token: 'floor-bg' },
  });

  const resolved = resolveSymbol(tileset, fontSources, metrics, 'danger-floor');

  assert.deepEqual(resolved.color, { token: 'danger' });
  assert.deepEqual(resolved.background, { token: 'floor-bg' });
});

test('resolveSymbol pulls calibrated draw position from the symbol\'s own fontFace', () => {
  const { metrics, fontSources } = setup();
  registerFontSource(fontSources, 'pixelyph', {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: { e000: { advanceWidth: 900, offsetX: 50 } },
  });
  const tileset = createTileset();
  registerSymbol(tileset, 'goblin', { fontFace: 'pixelyph', codepoint: 'e000', foreground: 'green' });

  const resolved = resolveSymbol(tileset, fontSources, metrics, 'goblin');

  assert.equal(resolved.text, String.fromCodePoint(0xe000));
  // pixelyph shares mono's (the implicit reference) span ratio -> scale 1 -> offsetX = 50 * (16/1000) = 0.8
  assert.equal(resolved.offsetX, 0.8);
});
