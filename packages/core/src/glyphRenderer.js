// The only module that ever touches ctx.font/ctx.fillStyle/ctx.fillText -
// kept minimal so the fake-recording-ctx tests stay tightly scoped to just
// this pair of functions. Everything upstream (camera, glyph metrics,
// visibility, animation, render-layer command building) is plain data and
// tested without a ctx at all.
import { glyphAdvance, baselineOffset, fontSizePx } from './glyphMetrics.js';

export function setLayerFont(ctx, metrics, fontFamily) {
  ctx.font = `${fontSizePx(metrics)}px ${fontFamily}`;
}

export function drawGlyphCell(ctx, metrics, cellSize, { col, row, text, color }) {
  const { offsetX } = glyphAdvance(metrics, text);
  const px = col * cellSize.width + metrics.horizontalPadding + offsetX;
  const py = row * cellSize.height + baselineOffset(metrics);

  // color is an opaque value/token passed straight through - resolving
  // palette tokens to an actual CSS color is session 22's job.
  ctx.fillStyle = color;
  ctx.fillText(text, px, py);
}
