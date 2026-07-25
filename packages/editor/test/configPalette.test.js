import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaletteRows,
  paletteSwatchCommand,
  renamePaletteToken,
  setPaletteToken,
  removePaletteToken,
  serializePaletteTokens,
  palettePath,
  setGradientDirection,
  setGradientStopOffset,
  setGradientStopColor,
  addGradientStop,
  removeGradientStop,
  isStopTokenRef,
} from '../src/configPalette.js';

test('buildPaletteRows classifies a raw color token as kind "color"', () => {
  const rows = buildPaletteRows({ wall: '#555555' });
  assert.deepEqual(rows, [{ name: 'wall', kind: 'color', value: '#555555' }]);
});

test('buildPaletteRows classifies a gradient token as kind "gradient", stops intact', () => {
  const gradient = {
    type: 'gradient',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#111111' },
      { offset: 1, color: { token: 'wall' } },
    ],
  };
  const rows = buildPaletteRows({ floor: gradient });
  assert.deepEqual(rows, [{ name: 'floor', kind: 'gradient', value: gradient }]);
});

test('buildPaletteRows preserves token order', () => {
  const rows = buildPaletteRows({ wall: '#555', floor: '#222', accent: '#e0a030' });
  assert.deepEqual(rows.map((row) => row.name), ['wall', 'floor', 'accent']);
});

test('paletteSwatchCommand passes a token reference through unresolved', () => {
  assert.deepEqual(paletteSwatchCommand('wall'), { col: 0, row: 0, text: ' ', background: { token: 'wall' } });
});

test('renamePaletteToken moves the value under the new key, preserving other entries', () => {
  const tokens = { wall: '#555', floor: '#222' };
  assert.deepEqual(renamePaletteToken(tokens, 'wall', 'stone'), { floor: '#222', stone: '#555' });
});

test('renamePaletteToken is a no-op when the name is unchanged', () => {
  const tokens = { wall: '#555' };
  assert.equal(renamePaletteToken(tokens, 'wall', 'wall'), tokens);
});

test('setPaletteToken adds or overwrites a token value without mutating the input', () => {
  const tokens = { wall: '#555' };
  const next = setPaletteToken(tokens, 'floor', '#222');
  assert.deepEqual(next, { wall: '#555', floor: '#222' });
  assert.deepEqual(tokens, { wall: '#555' });
});

test('removePaletteToken drops exactly the named token', () => {
  const tokens = { wall: '#555', floor: '#222' };
  assert.deepEqual(removePaletteToken(tokens, 'wall'), { floor: '#222' });
});

test('serializePaletteTokens emits a default-exported JS module', () => {
  const source = serializePaletteTokens({ wall: '#555555' });
  assert.equal(source, 'export default {\n  "wall": "#555555"\n};\n');
});

test('palettePath returns the default settings destination', () => {
  assert.equal(palettePath(), 'src/settings/palette.js');
});

const sampleGradient = {
  type: 'gradient',
  direction: 'vertical',
  stops: [
    { offset: 0, color: '#111111' },
    { offset: 1, color: { token: 'wall' } },
  ],
};

test('setGradientDirection replaces direction only', () => {
  const next = setGradientDirection(sampleGradient, 'horizontal');
  assert.equal(next.direction, 'horizontal');
  assert.deepEqual(next.stops, sampleGradient.stops);
});

test('setGradientStopOffset updates exactly one stop by index', () => {
  const next = setGradientStopOffset(sampleGradient, 0, 0.25);
  assert.equal(next.stops[0].offset, 0.25);
  assert.equal(next.stops[1].offset, 1);
});

test('setGradientStopColor updates exactly one stop by index, raw or token ref alike', () => {
  const next = setGradientStopColor(sampleGradient, 1, '#ff00ff');
  assert.equal(next.stops[1].color, '#ff00ff');
  assert.equal(next.stops[0].color, '#111111');
});

test('addGradientStop appends a new stop without mutating the input', () => {
  const next = addGradientStop(sampleGradient);
  assert.equal(next.stops.length, 3);
  assert.equal(sampleGradient.stops.length, 2);
});

test('removeGradientStop drops exactly the stop at index', () => {
  const next = removeGradientStop(sampleGradient, 0);
  assert.deepEqual(next.stops, [{ offset: 1, color: { token: 'wall' } }]);
});

test('isStopTokenRef distinguishes a { token } reference from a raw color', () => {
  assert.equal(isStopTokenRef({ token: 'wall' }), true);
  assert.equal(isStopTokenRef('#111111'), false);
  assert.equal(isStopTokenRef(undefined), false);
});
