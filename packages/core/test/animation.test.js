import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnimationState,
  startTween,
  advanceAnimation,
  tweenedPosition,
  addTransientEffect,
  activeEffects,
} from '../src/animation.js';

test('tweenedPosition returns from/to/midpoint purely as a function of now', () => {
  const state = createAnimationState();
  startTween(state, 'goblin', { from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, durationMs: 100, startTime: 1000 });

  assert.deepEqual(tweenedPosition(state, 'goblin', { x: -1, y: -1 }, 1000), { x: 0, y: 0 });
  assert.deepEqual(tweenedPosition(state, 'goblin', { x: -1, y: -1 }, 1100), { x: 10, y: 0 });
  assert.deepEqual(tweenedPosition(state, 'goblin', { x: -1, y: -1 }, 1050), { x: 5, y: 0 });
});

test('tweenedPosition falls back to the supplied position when the entity has no active tween', () => {
  const state = createAnimationState();
  const fallback = { x: 3, y: 3 };
  assert.deepEqual(tweenedPosition(state, 'ghost', fallback, 1000), fallback);
});

test('advanceAnimation purges an expired tween, falling back afterward', () => {
  const state = createAnimationState();
  startTween(state, 'goblin', { from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, durationMs: 100, startTime: 1000 });

  advanceAnimation(state, 1050);
  assert.ok(state.tweens.has('goblin'), 'still mid-tween');

  advanceAnimation(state, 1100);
  assert.ok(!state.tweens.has('goblin'), 'expired tween purged');

  const fallback = { x: 10, y: 0 };
  assert.deepEqual(tweenedPosition(state, 'goblin', fallback, 1200), fallback);
});

test('two simultaneous tweens on different entities do not interfere', () => {
  const state = createAnimationState();
  startTween(state, 'a', { from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, durationMs: 100, startTime: 1000 });
  startTween(state, 'b', { from: { x: 0, y: 0 }, to: { x: 0, y: 10 }, durationMs: 100, startTime: 1000 });

  assert.deepEqual(tweenedPosition(state, 'a', null, 1050), { x: 5, y: 0 });
  assert.deepEqual(tweenedPosition(state, 'b', null, 1050), { x: 0, y: 5 });
});

test('activeEffects includes an effect before expiry and excludes it after', () => {
  const state = createAnimationState();
  addTransientEffect(state, { id: 'damage-number', startTime: 1000, durationMs: 50 });

  assert.equal(activeEffects(state, 1025).length, 1);
  assert.equal(activeEffects(state, 1050).length, 0);
});

test('advanceAnimation prunes expired effects from state', () => {
  const state = createAnimationState();
  addTransientEffect(state, { id: 'hit-flash', startTime: 1000, durationMs: 50 });

  advanceAnimation(state, 1051);
  assert.equal(state.effects.length, 0);
});
