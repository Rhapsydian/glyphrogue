import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeymap } from '../src/keymap.js';
import { createKeyboardSource } from '../src/keyboardSource.js';

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

test('a bound keydown emits a press input action once', () => {
  const target = createFakeTarget();
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });
  const dispatched = [];
  createKeyboardSource({ target, keymap, dispatch: (event) => dispatched.push(event) });

  target.dispatch('keydown', { code: 'ArrowUp', repeat: false });

  assert.deepEqual(dispatched, [{ action: 'move-north', phase: 'press' }]);
});

test('held-key auto-repeat keydowns emit nothing further', () => {
  const target = createFakeTarget();
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });
  const dispatched = [];
  createKeyboardSource({ target, keymap, dispatch: (event) => dispatched.push(event) });

  target.dispatch('keydown', { code: 'ArrowUp', repeat: false });
  target.dispatch('keydown', { code: 'ArrowUp', repeat: true });
  target.dispatch('keydown', { code: 'ArrowUp', repeat: true });

  assert.deepEqual(dispatched, [{ action: 'move-north', phase: 'press' }]);
});

test('keyup emits a release input action', () => {
  const target = createFakeTarget();
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });
  const dispatched = [];
  createKeyboardSource({ target, keymap, dispatch: (event) => dispatched.push(event) });

  target.dispatch('keydown', { code: 'ArrowUp', repeat: false });
  target.dispatch('keyup', { code: 'ArrowUp' });

  assert.deepEqual(dispatched, [
    { action: 'move-north', phase: 'press' },
    { action: 'move-north', phase: 'release' },
  ]);
});

test('unbound keys emit nothing', () => {
  const target = createFakeTarget();
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });
  const dispatched = [];
  createKeyboardSource({ target, keymap, dispatch: (event) => dispatched.push(event) });

  target.dispatch('keydown', { code: 'KeyZ', repeat: false });
  target.dispatch('keyup', { code: 'KeyZ' });

  assert.deepEqual(dispatched, []);
});

test('stop() detaches both listeners', () => {
  const target = createFakeTarget();
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });
  const dispatched = [];
  const source = createKeyboardSource({ target, keymap, dispatch: (event) => dispatched.push(event) });

  assert.equal(target.hasListener('keydown'), true);
  assert.equal(target.hasListener('keyup'), true);

  source.stop();

  assert.equal(target.hasListener('keydown'), false);
  assert.equal(target.hasListener('keyup'), false);

  target.dispatch('keydown', { code: 'ArrowUp', repeat: false });
  assert.deepEqual(dispatched, []);
});
