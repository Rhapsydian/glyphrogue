import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureStack } from '../src/captureStack.js';
import { createInputPipeline } from '../src/inputPipeline.js';

test('routes to onFallthrough when the capture stack is empty', () => {
  const captureStack = createCaptureStack();
  const captured = [];
  const fallenThrough = [];
  const pipeline = createInputPipeline({
    captureStack,
    onCaptured: (event) => captured.push(event),
    onFallthrough: (event) => fallenThrough.push(event),
  });

  pipeline.handleInputAction({ action: 'move-north', phase: 'press' });

  assert.deepEqual(captured, []);
  assert.deepEqual(fallenThrough, [{ action: 'move-north', phase: 'press' }]);
});

test('routes to onCaptured with the topmost surface id when the stack is non-empty', () => {
  const captureStack = createCaptureStack();
  captureStack.push('inventory');
  const captured = [];
  const fallenThrough = [];
  const pipeline = createInputPipeline({
    captureStack,
    onCaptured: (event) => captured.push(event),
    onFallthrough: (event) => fallenThrough.push(event),
  });

  pipeline.handleInputAction({ action: 'confirm', phase: 'press' });

  assert.deepEqual(captured, [{ action: 'confirm', phase: 'press', surfaceId: 'inventory' }]);
  assert.deepEqual(fallenThrough, []);
});

test('the topmost surface claims everything - popping restores fallthrough', () => {
  const captureStack = createCaptureStack();
  const fallenThrough = [];
  const pipeline = createInputPipeline({
    captureStack,
    onCaptured: () => {},
    onFallthrough: (event) => fallenThrough.push(event),
  });

  captureStack.push('inventory');
  pipeline.handleInputAction({ action: 'move-north', phase: 'press' });
  assert.deepEqual(fallenThrough, []);

  captureStack.pop();
  pipeline.handleInputAction({ action: 'move-north', phase: 'press' });
  assert.deepEqual(fallenThrough, [{ action: 'move-north', phase: 'press' }]);
});
