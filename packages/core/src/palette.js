// Curated token palette with a raw-color escape hatch (rendering.md's
// Color/palette decision). Pure data - no ctx dependency. A gradient
// descriptor's own stop colors may themselves be { token } references,
// resolved one level (a token never points at another token).

export function createPalette(tokens = {}) {
  return { tokens };
}

export function resolveColor(palette, value) {
  if (value && typeof value === 'object' && 'token' in value) {
    return resolveToken(palette, value.token);
  }
  return resolveRaw(palette, value);
}

function resolveToken(palette, token) {
  const resolved = palette.tokens[token];
  return resolveRaw(palette, resolved);
}

function resolveRaw(palette, value) {
  if (value && typeof value === 'object' && value.type === 'gradient') {
    return {
      type: 'gradient',
      direction: value.direction ?? 'vertical',
      stops: value.stops.map((stop) => ({
        offset: stop.offset,
        color: resolveStopColor(palette, stop.color),
      })),
    };
  }
  return value;
}

function resolveStopColor(palette, color) {
  if (color && typeof color === 'object' && 'token' in color) {
    return palette.tokens[color.token];
  }
  return color;
}
