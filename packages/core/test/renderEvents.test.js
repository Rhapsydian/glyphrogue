import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRenderEventQueue,
  enqueueRenderEvent,
  createSequencerState,
  advanceSequencer,
} from '../src/renderEvents.js';

test('FIFO order is preserved', () => {
  const queue = createRenderEventQueue();
  enqueueRenderEvent(queue, { kind: 'sound', id: 'a' });
  enqueueRenderEvent(queue, { kind: 'sound', id: 'b' });
  assert.deepEqual(queue.events.map((e) => e.id), ['a', 'b']);
});

test('a zero-delay/zero-duration sound followed by an animation both process within one call at the same now', () => {
  const queue = createRenderEventQueue();
  enqueueRenderEvent(queue, { kind: 'sound', id: 'hit-sound' });
  enqueueRenderEvent(queue, { kind: 'animation', id: 'hit-anim', duration: 200 });

  const state = createSequencerState();
  const triggered = [];
  advanceSequencer(queue, state, 1000, (event) => triggered.push(event.id));

  assert.deepEqual(triggered, ['hit-sound', 'hit-anim']);
  assert.equal(state.current.id, 'hit-anim');
});

test('nonzero delay defers triggering until now reaches it', () => {
  const queue = createRenderEventQueue();
  enqueueRenderEvent(queue, { kind: 'sound', id: 'delayed', delay: 50 });

  const state = createSequencerState();
  const triggered = [];

  advanceSequencer(queue, state, 1000, (event) => triggered.push(event.id));
  assert.deepEqual(triggered, [], 'should not have fired yet');
  assert.equal(state.current.id, 'delayed');

  advanceSequencer(queue, state, 1049, (event) => triggered.push(event.id));
  assert.deepEqual(triggered, [], 'still not due');

  advanceSequencer(queue, state, 1050, (event) => triggered.push(event.id));
  assert.deepEqual(triggered, ['delayed']);
});

test('duration is counted from trigger time (delay + duration total occupancy)', () => {
  const queue = createRenderEventQueue();
  enqueueRenderEvent(queue, { kind: 'sound', id: 'a', delay: 20, duration: 30 });
  enqueueRenderEvent(queue, { kind: 'sound', id: 'b' });

  const state = createSequencerState();
  const triggered = [];
  const onTrigger = (event) => triggered.push(event.id);

  advanceSequencer(queue, state, 1000, onTrigger); // becomes current, delay not yet elapsed
  assert.equal(state.current.id, 'a');
  assert.deepEqual(triggered, []);

  advanceSequencer(queue, state, 1020, onTrigger); // delay elapsed, fires
  assert.deepEqual(triggered, ['a']);
  assert.equal(state.current.id, 'a', 'still blocking - duration not elapsed');

  advanceSequencer(queue, state, 1049, onTrigger); // 1020 + 30 = 1050, not yet
  assert.equal(state.current.id, 'a');

  advanceSequencer(queue, state, 1050, onTrigger); // now completes, advances to b
  assert.deepEqual(triggered, ['a', 'b']);
});

test('advancing an empty queue is a no-op', () => {
  const queue = createRenderEventQueue();
  const state = createSequencerState();
  assert.doesNotThrow(() => advanceSequencer(queue, state, 1000, () => assert.fail('should not trigger')));
  assert.equal(state.current, null);
});
