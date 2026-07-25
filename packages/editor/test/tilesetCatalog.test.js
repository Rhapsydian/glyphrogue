import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFontSourceRegistry, registerFontSource, createTileset, registerSymbol, createGlyphMetrics } from '@glyphrogue/core';
import {
  listFontSourceIds,
  getFontSourceEntry,
  isReferenceFontSource,
  listSymbolIds,
  getSymbolEntry,
  filterSymbols,
  hasGlyphManifest,
  UNICODE_BLOCK_PRESETS,
  presetCodepoints,
  buildCalibrationCommands,
} from '../src/tilesetCatalog.js';

function baseFontSources() {
  const fontSources = createFontSourceRegistry();
  registerFontSource(fontSources, 'base', { unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: {} });
  registerFontSource(fontSources, 'pixelyph-icons', {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: { e000: { advanceWidth: 1000, offsetX: 0 } },
  });
  return fontSources;
}

test('listFontSourceIds returns registered ids in registration order', () => {
  const fontSources = baseFontSources();
  assert.deepEqual(listFontSourceIds(fontSources), ['base', 'pixelyph-icons']);
});

test('getFontSourceEntry returns the stored { sourceMetrics, calibration } entry', () => {
  const fontSources = baseFontSources();
  const entry = getFontSourceEntry(fontSources, 'base');
  assert.equal(entry.sourceMetrics.unitsPerEm, 1000);
  assert.equal(entry.calibration.scale, 1);
});

test('isReferenceFontSource identifies the implicit first-registered source', () => {
  const fontSources = baseFontSources();
  assert.equal(isReferenceFontSource(fontSources, 'base'), true);
  assert.equal(isReferenceFontSource(fontSources, 'pixelyph-icons'), false);
});

test('isReferenceFontSource returns false for every source when nothing has been registered yet', () => {
  const fontSources = createFontSourceRegistry();
  assert.equal(isReferenceFontSource(fontSources, 'anything'), false);
});

test('listSymbolIds returns registered symbol ids in registration order', () => {
  const tileset = createTileset();
  registerSymbol(tileset, 'wall', { fontFace: 'base', codepoint: '23', foreground: { token: 'wall' } });
  registerSymbol(tileset, 'player', { fontFace: 'base', codepoint: '40', foreground: { token: 'player' } });
  assert.deepEqual(listSymbolIds(tileset), ['wall', 'player']);
});

test('getSymbolEntry returns the stored symbol definition', () => {
  const tileset = createTileset();
  registerSymbol(tileset, 'wall', { fontFace: 'base', codepoint: '23', foreground: { token: 'wall' } });
  assert.deepEqual(getSymbolEntry(tileset, 'wall'), { fontFace: 'base', codepoint: '23', foreground: { token: 'wall' } });
});

test('filterSymbols with no search returns every symbol', () => {
  const tileset = createTileset();
  registerSymbol(tileset, 'wall', { fontFace: 'base', codepoint: '23', foreground: { token: 'wall' } });
  registerSymbol(tileset, 'player', { fontFace: 'pixelyph-icons', codepoint: 'e000', foreground: { token: 'player' } });
  assert.deepEqual(
    filterSymbols(tileset).map((row) => row.id),
    ['wall', 'player'],
  );
});

test('filterSymbols matches by symbol id or font source, case-insensitively', () => {
  const tileset = createTileset();
  registerSymbol(tileset, 'wall', { fontFace: 'base', codepoint: '23', foreground: { token: 'wall' } });
  registerSymbol(tileset, 'player', { fontFace: 'pixelyph-icons', codepoint: 'e000', foreground: { token: 'player' } });

  assert.deepEqual(
    filterSymbols(tileset, { search: 'WALL' }).map((row) => row.id),
    ['wall'],
  );
  assert.deepEqual(
    filterSymbols(tileset, { search: 'pixelyph' }).map((row) => row.id),
    ['player'],
  );
});

test('hasGlyphManifest is false for an empty glyphs table', () => {
  const fontSources = baseFontSources();
  assert.equal(hasGlyphManifest(getFontSourceEntry(fontSources, 'base')), false);
});

test('hasGlyphManifest is true for a source with real manifest entries', () => {
  const fontSources = baseFontSources();
  assert.equal(hasGlyphManifest(getFontSourceEntry(fontSources, 'pixelyph-icons')), true);
});

test('presetCodepoints enumerates a preset range as lowercase hex strings', () => {
  const preset = UNICODE_BLOCK_PRESETS.find((p) => p.id === 'latin-1');
  const codepoints = presetCodepoints(preset, preset.end - preset.start + 1);
  assert.equal(codepoints[0], preset.start.toString(16));
  assert.equal(codepoints.at(-1), preset.end.toString(16));
});

test('presetCodepoints respects the limit parameter', () => {
  const preset = UNICODE_BLOCK_PRESETS.find((p) => p.id === 'box-drawing');
  assert.equal(presetCodepoints(preset, 5).length, 5);
});

test('buildCalibrationCommands produces one LivePreview command per sample codepoint', () => {
  const fontSources = baseFontSources();
  const metrics = createGlyphMetrics({ pixelsPerEm: 16 });
  const commands = buildCalibrationCommands(fontSources, metrics, 'base');
  assert.equal(commands.length, 8);
  assert.equal(commands[0].text, 'A');
  assert.equal(commands[0].row, 0);
  assert.deepEqual(
    commands.map((c) => c.col),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
});
