import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBindingCapture } from '../src/captureBinding.js';

function createFakeTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
    dispatch(type, event) {
      listeners.get(type)?.(event);
    },
    hasListener(type) {
      return listeners.has(type);
    },
  };
}

function buttons(pressedIndexes, count = 1) {
  const set = new Set(pressedIndexes);
  return Array.from({ length: count }, (_, i) => ({ pressed: set.has(i) }));
}

function fakeSource(frames) {
  let frame = 0;
  return () => frames[Math.min(frame++, frames.length - 1)];
}

test('an unbound keydown is still captured', () => {
  const target = createFakeTarget();
  const capture = createBindingCapture({ target });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  target.dispatch('keydown', { code: 'KeyZ', repeat: false });

  assert.deepEqual(captured, [{ device: 'key', code: 'KeyZ' }]);
});

test('auto-repeat keydowns are ignored; the next real keydown captures', () => {
  const target = createFakeTarget();
  const capture = createBindingCapture({ target });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  target.dispatch('keydown', { code: 'KeyA', repeat: true });
  target.dispatch('keydown', { code: 'KeyB', repeat: false });

  assert.deepEqual(captured, [{ device: 'key', code: 'KeyB' }]);
});

test('capture auto-stops after firing once', () => {
  const target = createFakeTarget();
  const capture = createBindingCapture({ target });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  target.dispatch('keydown', { code: 'KeyA', repeat: false });
  target.dispatch('keydown', { code: 'KeyB', repeat: false });

  assert.deepEqual(captured, [{ device: 'key', code: 'KeyA' }]);
  assert.equal(target.hasListener('keydown'), false);
});

test('stop() before any keydown detaches the listener and captures nothing', () => {
  const target = createFakeTarget();
  const capture = createBindingCapture({ target });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  capture.stop();
  target.dispatch('keydown', { code: 'KeyA', repeat: false });

  assert.deepEqual(captured, []);
});

test('starting a second capture works independently after the first completes', () => {
  const target = createFakeTarget();
  const capture = createBindingCapture({ target });
  const captured = [];

  capture.start((binding) => captured.push(binding));
  target.dispatch('keydown', { code: 'KeyA', repeat: false });

  capture.start((binding) => captured.push(binding));
  target.dispatch('keydown', { code: 'KeyB', repeat: false });

  assert.deepEqual(captured, [
    { device: 'key', code: 'KeyA' },
    { device: 'key', code: 'KeyB' },
  ]);
});

test('a gamepad button already held when capture starts does not fire on the priming poll', () => {
  const getGamepads = fakeSource([[{ buttons: buttons([0]), axes: [] }], [{ buttons: buttons([0]), axes: [] }]]);
  const capture = createBindingCapture({ getGamepads });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  capture.poll();
  capture.poll();

  assert.deepEqual(captured, []);
});

test('a gamepad button press edge is captured', () => {
  const getGamepads = fakeSource([
    [{ buttons: buttons([]), axes: [] }],
    [{ buttons: buttons([]), axes: [] }],
    [{ buttons: buttons([2], 3), axes: [] }],
  ]);
  const capture = createBindingCapture({ getGamepads });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  capture.poll();
  capture.poll();
  capture.poll();

  assert.deepEqual(captured, [{ device: 'gamepad-button', index: 2 }]);
});

test('capture auto-stops after a gamepad button fires - further polling is a no-op', () => {
  const getGamepads = fakeSource([
    [{ buttons: buttons([]), axes: [] }],
    [{ buttons: buttons([0]), axes: [] }],
    [{ buttons: buttons([0, 1]), axes: [] }],
  ]);
  const capture = createBindingCapture({ getGamepads });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  capture.poll();
  capture.poll();
  capture.poll();

  assert.deepEqual(captured, [{ device: 'gamepad-button', index: 0 }]);
});

test('an axis crossing the positive deadzone is captured', () => {
  const getGamepads = fakeSource([[{ buttons: [], axes: [0] }], [{ buttons: [], axes: [0] }], [{ buttons: [], axes: [0.9] }]]);
  const capture = createBindingCapture({ getGamepads, deadzone: 0.5 });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  capture.poll();
  capture.poll();
  capture.poll();

  assert.deepEqual(captured, [{ device: 'gamepad-axis', index: 0, direction: 'positive' }]);
});

test('an axis crossing the negative deadzone is captured', () => {
  const getGamepads = fakeSource([[{ buttons: [], axes: [0] }], [{ buttons: [], axes: [0] }], [{ buttons: [], axes: [-0.9] }]]);
  const capture = createBindingCapture({ getGamepads, deadzone: 0.5 });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  capture.poll();
  capture.poll();
  capture.poll();

  assert.deepEqual(captured, [{ device: 'gamepad-axis', index: 0, direction: 'negative' }]);
});

test('axis values within the deadzone are not captured', () => {
  const getGamepads = fakeSource([[{ buttons: [], axes: [0] }], [{ buttons: [], axes: [0] }], [{ buttons: [], axes: [0.2] }]]);
  const capture = createBindingCapture({ getGamepads, deadzone: 0.5 });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  capture.poll();
  capture.poll();
  capture.poll();

  assert.deepEqual(captured, []);
});

test('no gamepad connected is a no-op', () => {
  const getGamepads = fakeSource([[], [null, undefined]]);
  const capture = createBindingCapture({ getGamepads });
  const captured = [];
  capture.start((binding) => captured.push(binding));

  assert.doesNotThrow(() => {
    capture.poll();
    capture.poll();
  });
  assert.deepEqual(captured, []);
});

test('poll() before start() is a no-op', () => {
  const getGamepads = fakeSource([[{ buttons: buttons([0]), axes: [] }]]);
  const capture = createBindingCapture({ getGamepads });

  assert.doesNotThrow(() => capture.poll());
});
