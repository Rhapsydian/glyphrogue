// The tileset definition format (fonts-and-tilesets.md): a thin symbol ->
// { fontFace, codepoint, foreground, background } mapping. foreground/
// background stay unresolved color values (raw or { token }) - a symbol's
// tokens are defaults, not exclusive, so resolving them against a palette
// is deliberately left to the draw call (glyphRenderer.js), not baked in
// here.
//
// codepoint is always a lowercase hex string, uniformly across every font
// source - the same convention Pixelyph's manifest already uses for its
// private-use-area glyph codepoints (fonts-and-tilesets.md point C), just
// generalized to standard-font symbols too (e.g. '@' is codepoint '40').
// This keeps resolveSymbol's hex -> drawable-character conversion uniform
// regardless of which kind of font source a symbol's glyph lives in.
import { createRegistry, register, get } from './registry.js';
import { getFontSource, calibratedGlyphAdvance, calibratedBaselineOffset } from './fontSources.js';

export function createTileset() {
  return createRegistry();
}

export function registerSymbol(tileset, symbol, entry, options = {}) {
  register(tileset, symbol, entry, options);
}

export function resolveSymbol(tileset, fontSourceRegistry, metrics, symbol) {
  const entry = get(tileset, symbol);
  const fontSource = getFontSource(fontSourceRegistry, entry.fontFace);
  const { sourceMetrics, calibration } = fontSource;

  const { offsetX } = calibratedGlyphAdvance(metrics, sourceMetrics, calibration, entry.codepoint);
  const baselineOffsetPx = calibratedBaselineOffset(metrics, calibration);
  const text = String.fromCodePoint(parseInt(entry.codepoint, 16));

  return { text, offsetX, baselineOffsetPx, color: entry.foreground, background: entry.background };
}
