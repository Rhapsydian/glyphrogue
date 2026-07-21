import test from 'node:test';
import assert from 'node:assert/strict';
import { createPalette, resolveColor } from '../src/palette.js';

test('resolveColor passes a raw string through unchanged', () => {
  const palette = createPalette({ danger: 'red' });
  assert.equal(resolveColor(palette, 'gold'), 'gold');
});

test('resolveColor resolves a { token } reference against the palette', () => {
  const palette = createPalette({ danger: '#c00' });
  assert.equal(resolveColor(palette, { token: 'danger' }), '#c00');
});

test('resolveColor resolves a token to a gradient descriptor', () => {
  const palette = createPalette({
    'wall-stone': { type: 'gradient', stops: [{ offset: 0, color: '#888' }, { offset: 1, color: '#444' }] },
  });
  assert.deepEqual(resolveColor(palette, { token: 'wall-stone' }), {
    type: 'gradient',
    direction: 'vertical',
    stops: [{ offset: 0, color: '#888' }, { offset: 1, color: '#444' }],
  });
});

test('resolveColor defaults a gradient direction to vertical but preserves an explicit horizontal', () => {
  const palette = createPalette({});
  const gradient = { type: 'gradient', direction: 'horizontal', stops: [{ offset: 0, color: 'a' }, { offset: 1, color: 'b' }] };
  assert.equal(resolveColor(palette, gradient).direction, 'horizontal');
});

test('resolveColor resolves { token } references nested inside a gradient stop', () => {
  const palette = createPalette({ 'stone-lit': '#aaa', 'stone-shadow': '#333' });
  const gradient = {
    type: 'gradient',
    stops: [{ offset: 0, color: { token: 'stone-lit' } }, { offset: 1, color: { token: 'stone-shadow' } }],
  };
  assert.deepEqual(resolveColor(palette, gradient).stops, [
    { offset: 0, color: '#aaa' },
    { offset: 1, color: '#333' },
  ]);
});

test('a token never points at another token (resolves one level only)', () => {
  const palette = createPalette({ alias: { token: 'danger' }, danger: 'red' });
  assert.deepEqual(resolveColor(palette, { token: 'alias' }), { token: 'danger' });
});
