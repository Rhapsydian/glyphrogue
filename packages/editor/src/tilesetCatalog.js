// Enumeration/filtering helpers for the tileset/font-calibration editor
// (docs/design/editor.md: "Tileset/font-calibration editor"). Same posture
// as generatorCatalog.js/contentCatalog.js - pure functions over an already-
// live fontSourceRegistry/tileset a game (or here, the dev fixture) already
// built, no Svelte/DOM dependency so this stays unit-testable under
// node:test. A fontSourceRegistry's enumerable registry is nested at
// .registry (createFontSourceRegistry's own return shape); a tileset from
// createTileset() *is* the raw registry, since tileset.js calls
// createRegistry() directly with no wrapper.
import { getOrderedIds, get, getFontSource, calibratedGlyphAdvance, calibratedBaselineOffset } from '@glyphrogue/core';

export function listFontSourceIds(fontSourceRegistry) {
  return getOrderedIds(fontSourceRegistry.registry);
}

export function getFontSourceEntry(fontSourceRegistry, id) {
  return get(fontSourceRegistry.registry, id);
}

export function isReferenceFontSource(fontSourceRegistry, id) {
  return fontSourceRegistry.referenceId === id;
}

export function listSymbolIds(tileset) {
  return getOrderedIds(tileset);
}

export function getSymbolEntry(tileset, symbol) {
  return get(tileset, symbol);
}

export function filterSymbols(tileset, { search } = {}) {
  const needle = search?.toLowerCase();
  return listSymbolIds(tileset)
    .map((id) => ({ id, ...getSymbolEntry(tileset, id) }))
    .filter((row) => !needle || row.id.toLowerCase().includes(needle) || row.fontFace.toLowerCase().includes(needle));
}

// A Pixelyph-imported source has a real { meta, glyphs } manifest to browse
// directly (fonts-and-tilesets.md); a plain system/monospace fallback
// registers with an empty (or absent) glyphs table, so picking a codepoint
// there falls back to raw input + Unicode block presets instead.
export function hasGlyphManifest(fontSourceEntry) {
  return Object.keys(fontSourceEntry.sourceMetrics.glyphs ?? {}).length > 0;
}

// Quick-jump discovery aid for the non-manifest glyph picker (editor.md:
// "raw input combined with presets, not one or the other") - a curated
// handful of commonly-useful ranges, not an exhaustive Unicode block list.
export const UNICODE_BLOCK_PRESETS = [
  { id: 'latin-1', label: 'Latin-1 Supplement', start: 0x00a0, end: 0x00ff },
  { id: 'box-drawing', label: 'Box Drawing', start: 0x2500, end: 0x257f },
  { id: 'block-elements', label: 'Block Elements', start: 0x2580, end: 0x259f },
  { id: 'misc-symbols', label: 'Misc Symbols', start: 0x2600, end: 0x26ff },
];

export function presetCodepoints(preset, limit = 64) {
  const codepoints = [];
  for (let cp = preset.start; cp <= preset.end && codepoints.length < limit; cp++) {
    codepoints.push(cp.toString(16));
  }
  return codepoints;
}

// A fixed sample string ("A a G g 0 9 # @") run through the same calibrated
// glyph math tileset.js's resolveSymbol uses internally, but without needing
// a real tileset entry - the calibration tab tunes a font source in
// isolation, before any symbol necessarily references it.
const CALIBRATION_SAMPLE_CODEPOINTS = ['41', '61', '47', '67', '30', '39', '23', '40'];

export function buildCalibrationCommands(fontSourceRegistry, metrics, sourceId) {
  const { sourceMetrics, calibration } = getFontSource(fontSourceRegistry, sourceId);
  return CALIBRATION_SAMPLE_CODEPOINTS.map((codepoint, i) => {
    const { offsetX } = calibratedGlyphAdvance(metrics, sourceMetrics, calibration, codepoint);
    const baselineOffsetPx = calibratedBaselineOffset(metrics, calibration);
    return { col: i, row: 0, text: String.fromCodePoint(parseInt(codepoint, 16)), offsetX, baselineOffsetPx };
  });
}
