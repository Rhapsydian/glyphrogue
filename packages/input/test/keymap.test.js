import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeymap, resolveBinding, bindingsFor, rebind } from '../src/keymap.js';

test('resolves a bound key to its input action', () => {
  const keymap = createKeymap({
    'move-north': [{ device: 'key', code: 'ArrowUp' }, { device: 'key', code: 'KeyK' }],
  });

  assert.deepEqual(resolveBinding(keymap, { device: 'key', code: 'ArrowUp' }), ['move-north']);
  assert.deepEqual(resolveBinding(keymap, { device: 'key', code: 'KeyK' }), ['move-north']);
});

test('unbound physical input resolves to no input actions', () => {
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });

  assert.deepEqual(resolveBinding(keymap, { device: 'key', code: 'ArrowDown' }), []);
});

test('a single binding can resolve to multiple input actions', () => {
  const keymap = createKeymap({
    confirm: [{ device: 'key', code: 'Enter' }],
    'menu-select': [{ device: 'key', code: 'Enter' }],
  });

  assert.deepEqual(
    resolveBinding(keymap, { device: 'key', code: 'Enter' }).sort(),
    ['confirm', 'menu-select'],
  );
});

test('distinguishes gamepad-button and gamepad-axis bindings with the same index', () => {
  const keymap = createKeymap({
    'menu-confirm': [{ device: 'gamepad-button', index: 0 }],
    'move-north': [{ device: 'gamepad-axis', index: 0, direction: 'negative' }],
  });

  assert.deepEqual(resolveBinding(keymap, { device: 'gamepad-button', index: 0 }), ['menu-confirm']);
  assert.deepEqual(
    resolveBinding(keymap, { device: 'gamepad-axis', index: 0, direction: 'negative' }),
    ['move-north'],
  );
});

test('bindingsFor returns the raw binding array for an input action', () => {
  const bindings = { 'move-north': [{ device: 'key', code: 'ArrowUp' }] };
  const keymap = createKeymap(bindings);

  assert.deepEqual(bindingsFor(keymap, 'move-north'), bindings['move-north']);
  assert.deepEqual(bindingsFor(keymap, 'unknown-action'), []);
});

test('rebind replaces an input action\'s bindings and updates lookup', () => {
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });
  const rebound = rebind(keymap, 'move-north', [{ device: 'key', code: 'KeyW' }]);

  assert.deepEqual(bindingsFor(rebound, 'move-north'), [{ device: 'key', code: 'KeyW' }]);
  assert.deepEqual(resolveBinding(rebound, { device: 'key', code: 'ArrowUp' }), []);
  assert.deepEqual(resolveBinding(rebound, { device: 'key', code: 'KeyW' }), ['move-north']);

  // original keymap is untouched
  assert.deepEqual(resolveBinding(keymap, { device: 'key', code: 'ArrowUp' }), ['move-north']);
});
