// Multiple font sources composed within one shared cell grid
// (fonts-and-tilesets.md): each source gets a stored, override-able
// calibration record (scale, baselineOffset, horizontalCenteringMode)
// mapping its own natural glyph size onto the tileset's uniform cell.
//
// Default derivation is metrics-based, not raster-measurement-based - every
// font source (a generic OpenType font's own tables, and Pixelyph's
// manifest meta block) exposes unitsPerEm/ascender/descender, so the
// default calibration can be computed as pure arithmetic over metadata,
// fully unit-testable with no live ctx/font dependency, same discipline
// glyphMetrics.js holds.
import { createRegistry, register, get } from './registry.js';
import { baselineOffset } from './glyphMetrics.js';

function verticalSpanRatio({ unitsPerEm, ascender, descender }) {
  return (ascender - descender) / unitsPerEm;
}

function ascenderRatio({ unitsPerEm, ascender }) {
  return ascender / unitsPerEm;
}

// referenceRatio: the calibration reference's own verticalSpanRatio, or
// null for the (rare) case nothing has been registered/pinned yet - a
// source registered while it's still null becomes the implicit reference
// itself (scale/baselineOffset both come out to identity).
export function deriveCalibration(sourceMetrics, referenceRatio, referenceAscenderRatio) {
  const ownRatio = verticalSpanRatio(sourceMetrics);
  const scale = referenceRatio == null ? 1 : referenceRatio / ownRatio;
  const baselineOffset = referenceAscenderRatio == null ? 0 : referenceAscenderRatio - ascenderRatio(sourceMetrics);
  return { scale, baselineOffset, horizontalCenteringMode: 'advance' };
}

// reference: optional raw sourceMetrics for the font source that should
// act as the calibration standard, pinned at creation time so it's
// independent of whatever order registerFontSource calls happen in later
// (e.g. a Pixelyph-authored icon font declared the intended standard,
// registered after a monospace fallback). Omitted: the first font source
// registered becomes the reference instead (today's simple default).
export function createFontSourceRegistry({ reference } = {}) {
  return {
    registry: createRegistry(),
    referenceRatio: reference ? verticalSpanRatio(reference) : null,
    referenceAscenderRatio: reference ? ascenderRatio(reference) : null,
    referenceLocked: !!reference,
  };
}

export function registerFontSource(fontSourceRegistry, id, sourceMetrics, options = {}) {
  if (!fontSourceRegistry.referenceLocked && fontSourceRegistry.referenceRatio === null) {
    fontSourceRegistry.referenceRatio = verticalSpanRatio(sourceMetrics);
    fontSourceRegistry.referenceAscenderRatio = ascenderRatio(sourceMetrics);
  }

  const calibration = deriveCalibration(
    sourceMetrics,
    fontSourceRegistry.referenceRatio,
    fontSourceRegistry.referenceAscenderRatio,
  );
  register(fontSourceRegistry.registry, id, { sourceMetrics, calibration }, options);
}

export function getFontSource(fontSourceRegistry, id) {
  return get(fontSourceRegistry.registry, id);
}

// {advanceWidth, offsetX} in px, the calibrated analog of glyphMetrics.js's
// glyphAdvance - scaled against this source's own unitsPerEm/glyph table
// (not the shared metrics'), then by the calibration's scale factor.
export function calibratedGlyphAdvance(metrics, sourceMetrics, calibration, codepoint) {
  const scale = (metrics.pixelsPerEm / sourceMetrics.unitsPerEm) * calibration.scale;
  const glyph = sourceMetrics.glyphs?.[codepoint];
  const advanceWidth = (glyph?.advanceWidth ?? sourceMetrics.fallbackAdvanceWidth ?? sourceMetrics.unitsPerEm) * scale;
  const offsetX = (glyph?.offsetX ?? 0) * scale;
  return { advanceWidth, offsetX };
}

// Absolute px, the calibrated analog of glyphMetrics.js's baselineOffset -
// shifts a font source's baseline by its calibration's ratio-of-cell-height
// delta so sources with different ascender proportions align visually.
export function calibratedBaselineOffset(metrics, calibration) {
  return baselineOffset(metrics) + calibration.baselineOffset * metrics.pixelsPerEm;
}
