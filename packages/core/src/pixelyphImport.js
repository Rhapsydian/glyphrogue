// Consumes Pixelyph's exported glyph manifest (fonts-and-tilesets.md's
// asset-only boundary: Glyphrogue never imports Pixelyph source code, only
// its exported artifacts). Pure data transform - no file I/O/fetch, the
// caller loads/parses the manifest JSON however its own build wants to
// (same DI posture as storage.js's backends).
//
// manifest: { meta: { unitsPerEm, ascender, descender, ... }, glyphs: {
// [hexCodepoint]: { advanceWidth, offsetX, ... } } } - the shape
// generateGlyphManifest() in Pixelyph's glyphManifest.js produces, glyphs
// keyed by lowercase hex codepoint exactly like tileset.js expects.
export function glyphManifestToFontSource(manifest) {
  const { meta, glyphs } = manifest;
  const sourceGlyphs = {};
  for (const [codepoint, glyph] of Object.entries(glyphs)) {
    sourceGlyphs[codepoint] = { advanceWidth: glyph.advanceWidth, offsetX: glyph.offsetX };
  }

  return {
    unitsPerEm: meta.unitsPerEm,
    ascender: meta.ascender,
    descender: meta.descender,
    glyphs: sourceGlyphs,
  };
}
