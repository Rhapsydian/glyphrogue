import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, addActor, removeActor, next, spend } from '../src/scheduler.js';

test('next picks the higher-budget actor', () => {
  const scheduler = createScheduler(100);
  addActor(scheduler, 'a', 10);
  addActor(scheduler, 'b', 50);

  assert.equal(next(scheduler), 'b');
});

test('spend reduces budget and changes who is next', () => {
  const scheduler = createScheduler(100);
  addActor(scheduler, 'a', 10);
  addActor(scheduler, 'b', 50);

  spend(scheduler, 'b', 60);

  assert.equal(next(scheduler), 'a');
});

test('budgets can go negative', () => {
  const scheduler = createScheduler(100);
  addActor(scheduler, 'a', 10);

  spend(scheduler, 'a', 60);

  assert.equal(scheduler.actors.get('a'), -50);
});

test('removeActor excludes an entity even with the highest budget', () => {
  const scheduler = createScheduler(100);
  addActor(scheduler, 'a', 10);
  addActor(scheduler, 'b', 50);

  removeActor(scheduler, 'b');

  assert.equal(next(scheduler), 'a');
});

test('a round refill kicks in once every actor is at or below zero', () => {
  const scheduler = createScheduler(100);
  addActor(scheduler, 'a', 10);
  addActor(scheduler, 'b', 5);

  spend(scheduler, 'a', 10); // a = 0
  spend(scheduler, 'b', 5); // b = 0

  // both at 0 -> next() should refill everyone by roundBudget before picking
  next(scheduler);

  assert.equal(scheduler.actors.get('a'), 100);
  assert.equal(scheduler.actors.get('b'), 100);
});

test('equal-budget tie resolves to the earlier-added actor', () => {
  const scheduler = createScheduler(100);
  addActor(scheduler, 'first', 20);
  addActor(scheduler, 'second', 20);

  assert.equal(next(scheduler), 'first');
});
