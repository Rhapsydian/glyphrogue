// The only module that ever touches ctx.font/ctx.fillStyle/ctx.fillText/
// ctx.fillRect/ctx.createLinearGradient - kept minimal so the
// fake-recording-ctx tests stay tightly scoped to just this handful of
// functions. Everything upstream (camera, glyph metrics, visibility,
// animation, render-layer command building, palette token resolution) is
// plain data and tested without a ctx at all.
import { glyphAdvance, baselineOffset, fontSizePx } from './glyphMetrics.js';
import { resolveColor } from './palette.js';

export function setLayerFont(ctx, metrics, fontFamily) {
  ctx.font = `${fontSizePx(metrics)}px ${fontFamily}`;
}

// value: a raw color/gradient, or a { token } reference resolved against
// palette (omit palette to skip resolution entirely - a raw string passes
// straight through either way, so every pre-checkpoint-4 caller is
// unaffected). A resolved gradient descriptor becomes a real
// CanvasGradient sized to cellBounds; nothing else needs ctx at all.
function resolveFillStyle(ctx, palette, value, cellBounds) {
  const resolved = palette ? resolveColor(palette, value) : value;
  if (resolved && typeof resolved === 'object' && resolved.type === 'gradient') {
    return buildGradient(ctx, resolved, cellBounds);
  }
  return resolved;
}

function buildGradient(ctx, gradient, { x, y, width, height }) {
  const [x0, y0, x1, y1] = gradient.direction === 'horizontal' ? [x, y, x + width, y] : [x, y, x, y + height];
  const canvasGradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const stop of gradient.stops) {
    canvasGradient.addColorStop(stop.offset, stop.color);
  }
  return canvasGradient;
}

// A second, separate fill drawn under a glyph (fonts-and-tilesets.md's
// material tinting) - kept independent of drawGlyphCell rather than folded
// together, since a background changes far less often than the glyph over
// it; see BACKLOG.md's redraw-cadence-decoupling deferred item.
export function drawCellBackground(ctx, cellSize, { col, row }, value, palette) {
  const cellBounds = { x: col * cellSize.width, y: row * cellSize.height, width: cellSize.width, height: cellSize.height };
  ctx.fillStyle = resolveFillStyle(ctx, palette, value, cellBounds);
  ctx.fillRect(cellBounds.x, cellBounds.y, cellBounds.width, cellBounds.height);
}

// offsetX/baselineOffsetPx: optional pre-computed overrides (from
// fontSources.js's calibratedGlyphAdvance/calibratedBaselineOffset) for a
// glyph drawn from a non-base font source in a multi-source tileset -
// omitted, this behaves exactly as before (shared-metrics-only, single
// font source). palette: optional, resolves a { token }/gradient color -
// omitted (or a raw string color), this behaves exactly as before too.
export function drawGlyphCell(ctx, metrics, cellSize, { col, row, text, color, offsetX: offsetXOverride, baselineOffsetPx, palette }) {
  const offsetX = offsetXOverride !== undefined ? offsetXOverride : glyphAdvance(metrics, text).offsetX;
  const px = col * cellSize.width + metrics.horizontalPadding + offsetX;
  const py = row * cellSize.height + (baselineOffsetPx !== undefined ? baselineOffsetPx : baselineOffset(metrics));

  const cellBounds = { x: col * cellSize.width, y: row * cellSize.height, width: cellSize.width, height: cellSize.height };
  ctx.fillStyle = resolveFillStyle(ctx, palette, color, cellBounds);
  ctx.fillText(text, px, py);
}

// Convenience wrapper composing drawCellBackground + drawGlyphCell (mirrors
// paintLayer's existing role as a composition over primitives) - draws a
// background only when the command actually carries one.
export function drawTileCell(ctx, metrics, cellSize, palette, command) {
  const { col, row, background } = command;
  if (background !== undefined) {
    drawCellBackground(ctx, cellSize, { col, row }, background, palette);
  }
  drawGlyphCell(ctx, metrics, cellSize, { ...command, palette });
}
