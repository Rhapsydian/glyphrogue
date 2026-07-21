// The one shared glyph-metrics source both the canvas viewport and a future
// DOM text path derive cell size from (rendering.md's "shared glyph-metrics
// source" decision) - mirrors the shape Pixelyph's GlyphSet.js/
// compileFont.js already use internally. Pure data, no ctx/DOM dependency;
// wiring these values onto CSS custom properties for a DOM path is future
// work (no UI framework exists yet), not built here.

export function createGlyphMetrics({
  pixelsPerEm,
  unitsPerEm = 1000,
  baselineRow = 0.8,
  horizontalPadding = 0,
  fallbackAdvanceWidth = unitsPerEm,
  glyphs = {},
} = {}) {
  return { pixelsPerEm, unitsPerEm, baselineRow, horizontalPadding, fallbackAdvanceWidth, glyphs };
}

export function cellSize(metrics) {
  return { width: metrics.pixelsPerEm, height: metrics.pixelsPerEm };
}

// Falls back to fallbackAdvanceWidth/offsetX:0 for a glyph with no
// per-glyph override (the monospace default) - advanceWidth/offsetX are in
// font design units, scaled to px the same way pixelsPerEm scales
// unitsPerEm.
export function glyphAdvance(metrics, codepoint) {
  const scale = metrics.pixelsPerEm / metrics.unitsPerEm;
  const glyph = metrics.glyphs[codepoint];
  const advanceWidth = glyph?.advanceWidth ?? metrics.fallbackAdvanceWidth;
  const offsetX = glyph?.offsetX ?? 0;
  return { advanceWidth: advanceWidth * scale, offsetX: offsetX * scale };
}

export function baselineOffset(metrics) {
  return metrics.pixelsPerEm * metrics.baselineRow;
}

export function fontSizePx(metrics) {
  return metrics.pixelsPerEm;
}
