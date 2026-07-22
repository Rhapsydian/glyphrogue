import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureStack } from '../src/captureStack.js';

test('starts empty', () => {
  const stack = createCaptureStack();

  assert.equal(stack.isEmpty(), true);
  assert.equal(stack.peek(), undefined);
});

test('push makes the stack non-empty and peek returns the topmost id', () => {
  const stack = createCaptureStack();

  stack.push('inventory');
  assert.equal(stack.isEmpty(), false);
  assert.equal(stack.peek(), 'inventory');

  stack.push('confirm-dialog');
  assert.equal(stack.peek(), 'confirm-dialog');
});

test('pop returns and removes the topmost entry, restoring what was beneath it', () => {
  const stack = createCaptureStack();
  stack.push('inventory');
  stack.push('confirm-dialog');

  assert.equal(stack.pop(), 'confirm-dialog');
  assert.equal(stack.peek(), 'inventory');

  assert.equal(stack.pop(), 'inventory');
  assert.equal(stack.isEmpty(), true);
});
