import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier } from '../src/stateNotifier.js';

test('notify calls every subscriber with no arguments', () => {
  const notifier = createNotifier();
  const calls = [];
  notifier.subscribe(() => calls.push('a'));
  notifier.subscribe(() => calls.push('b'));

  notifier.notify();

  assert.deepEqual(calls, ['a', 'b']);
});

test('notify with no subscribers is a no-op', () => {
  const notifier = createNotifier();

  assert.doesNotThrow(() => notifier.notify());
});

test('unsubscribing stops further notifications', () => {
  const notifier = createNotifier();
  const calls = [];
  const unsubscribe = notifier.subscribe(() => calls.push('a'));
  notifier.subscribe(() => calls.push('b'));

  notifier.notify();
  unsubscribe();
  notifier.notify();

  assert.deepEqual(calls, ['a', 'b', 'b']);
});
