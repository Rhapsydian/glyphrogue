// Config UI's Palette tab logic (docs/design/editor.md: "Config UI" -
// palette is author-facing content, not a runtime settings slice; neither
// input actions nor palette tokens are a registered concept, so this
// reads the palette's tokens object directly rather than a manifest).
// Pure logic, kept separate from ConfigUI.svelte, same split
// narrowForm.js/mapEditorExport.js already use for their own tools.

const GRADIENT_TYPE = 'gradient';

function isGradient(value) {
  return Boolean(value && typeof value === 'object' && value.type === GRADIENT_TYPE);
}

// One row per top-level token - accounting for the recursive structure
// (palette.js: a token is a color or a gradient with nested stops, each
// stop possibly itself a { token } reference, resolved one level, never
// further). Surfaced as-is rather than pre-resolved, so editing a stop's
// token reference stays a token-name edit, not a flattened color.
export function buildPaletteRows(tokens) {
  return Object.entries(tokens).map(([name, value]) => ({
    name,
    kind: isGradient(value) ? 'gradient' : 'color',
    value,
  }));
}

// A live-preview command for a single swatch - passes the color value
// straight through rather than pre-resolving (a raw color, or a
// { token } reference), since paintLayer/drawTileCell already resolve
// palette tokens themselves whenever a palette is supplied
// (glyphRenderer.js's resolveFillStyle). Covers both a top-level token's
// own swatch and a gradient stop's individual swatch alike.
export function swatchCommand(colorValue) {
  return { col: 0, row: 0, text: ' ', background: colorValue };
}

export function paletteSwatchCommand(tokenName) {
  return swatchCommand({ token: tokenName });
}

export function renamePaletteToken(tokens, previousName, nextName) {
  if (previousName === nextName) return tokens;
  const { [previousName]: value, ...rest } = tokens;
  return { ...rest, [nextName]: value };
}

export function setPaletteToken(tokens, name, value) {
  return { ...tokens, [name]: value };
}

export function removePaletteToken(tokens, name) {
  const { [name]: _removed, ...rest } = tokens;
  return rest;
}

export function serializePaletteTokens(tokens) {
  return `export default ${JSON.stringify(tokens, null, 2)};\n`;
}

export function palettePath() {
  return 'src/settings/palette.js';
}

// Gradient stop editing (palette.js: a gradient's own stop colors may
// themselves be { token } references, resolved one level - never further,
// and never mixed with a raw value in the same field). All pure/immutable,
// same controlled-component posture as compositionSteps.js's step helpers.
export function setGradientDirection(gradient, direction) {
  return { ...gradient, direction };
}

export function setGradientStopOffset(gradient, index, offset) {
  const stops = gradient.stops.map((stop, i) => (i === index ? { ...stop, offset } : stop));
  return { ...gradient, stops };
}

export function setGradientStopColor(gradient, index, color) {
  const stops = gradient.stops.map((stop, i) => (i === index ? { ...stop, color } : stop));
  return { ...gradient, stops };
}

export function addGradientStop(gradient) {
  return { ...gradient, stops: [...gradient.stops, { offset: 1, color: '#ffffff' }] };
}

export function removeGradientStop(gradient, index) {
  return { ...gradient, stops: gradient.stops.filter((_, i) => i !== index) };
}

export function isStopTokenRef(color) {
  return Boolean(color && typeof color === 'object' && 'token' in color);
}
