import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeymap } from '../src/keymap.js';
import { createGamepadSource } from '../src/gamepadSource.js';

function buttons(pressedIndexes, count = 1) {
  const set = new Set(pressedIndexes);
  return Array.from({ length: count }, (_, i) => ({ pressed: set.has(i) }));
}

function fakeSource(frames) {
  let frame = 0;
  return () => frames[Math.min(frame++, frames.length - 1)];
}

test('button press and release edges emit once each', () => {
  const keymap = createKeymap({ 'menu-confirm': [{ device: 'gamepad-button', index: 0 }] });
  const dispatched = [];
  const getGamepads = fakeSource([
    [{ buttons: buttons([]), axes: [] }],
    [{ buttons: buttons([0]), axes: [] }],
    [{ buttons: buttons([0]), axes: [] }],
    [{ buttons: buttons([]), axes: [] }],
  ]);
  const source = createGamepadSource({ getGamepads, keymap, dispatch: (e) => dispatched.push(e) });

  source.poll();
  source.poll();
  source.poll();
  source.poll();

  assert.deepEqual(dispatched, [
    { action: 'menu-confirm', phase: 'press' },
    { action: 'menu-confirm', phase: 'release' },
  ]);
});

test('axis crossing the positive deadzone emits press then release', () => {
  const keymap = createKeymap({ 'move-east': [{ device: 'gamepad-axis', index: 0, direction: 'positive' }] });
  const dispatched = [];
  const getGamepads = fakeSource([
    [{ buttons: [], axes: [0] }],
    [{ buttons: [], axes: [0.9] }],
    [{ buttons: [], axes: [0.9] }],
    [{ buttons: [], axes: [0] }],
  ]);
  const source = createGamepadSource({ getGamepads, keymap, deadzone: 0.5, dispatch: (e) => dispatched.push(e) });

  source.poll();
  source.poll();
  source.poll();
  source.poll();

  assert.deepEqual(dispatched, [
    { action: 'move-east', phase: 'press' },
    { action: 'move-east', phase: 'release' },
  ]);
});

test('axis crossing the negative deadzone is independent of the positive direction', () => {
  const keymap = createKeymap({
    'move-east': [{ device: 'gamepad-axis', index: 0, direction: 'positive' }],
    'move-west': [{ device: 'gamepad-axis', index: 0, direction: 'negative' }],
  });
  const dispatched = [];
  const getGamepads = fakeSource([
    [{ buttons: [], axes: [0] }],
    [{ buttons: [], axes: [-0.9] }],
    [{ buttons: [], axes: [0] }],
  ]);
  const source = createGamepadSource({ getGamepads, keymap, deadzone: 0.5, dispatch: (e) => dispatched.push(e) });

  source.poll();
  source.poll();
  source.poll();

  assert.deepEqual(dispatched, [
    { action: 'move-west', phase: 'press' },
    { action: 'move-west', phase: 'release' },
  ]);
});

test('axis values within the deadzone emit nothing', () => {
  const keymap = createKeymap({ 'move-east': [{ device: 'gamepad-axis', index: 0, direction: 'positive' }] });
  const dispatched = [];
  const getGamepads = fakeSource([
    [{ buttons: [], axes: [0] }],
    [{ buttons: [], axes: [0.2] }],
    [{ buttons: [], axes: [-0.3] }],
  ]);
  const source = createGamepadSource({ getGamepads, keymap, deadzone: 0.5, dispatch: (e) => dispatched.push(e) });

  source.poll();
  source.poll();
  source.poll();

  assert.deepEqual(dispatched, []);
});

test('no gamepad connected is a no-op', () => {
  const keymap = createKeymap({ 'menu-confirm': [{ device: 'gamepad-button', index: 0 }] });
  const dispatched = [];
  const getGamepads = fakeSource([[], [null, undefined]]);
  const source = createGamepadSource({ getGamepads, keymap, dispatch: (e) => dispatched.push(e) });

  assert.doesNotThrow(() => {
    source.poll();
    source.poll();
  });
  assert.deepEqual(dispatched, []);
});
