import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createEntity, addComponent, hasComponent } from '../src/world.js';
import { createRegistry } from '../src/registry.js';
import { registerRule } from '../src/actions.js';
import { createScheduler, addActor } from '../src/scheduler.js';
import {
  createEngine,
  isLocked,
  act,
  resolvePlayerAction,
  run,
} from '../src/engine.js';
import { createRenderEventQueue } from '../src/renderEvents.js';

function setupWander(registry) {
  registerRule(registry, 'wanders', 'TakeTurn', (action) => ({
    followOn: [{ type: 'Move', entity: action.entity, cost: 100 }],
  }));
}

test('a non-player actor auto-dispatches TakeTurn and spends the resolved cost', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const goblin = createEntity(world);
  addActor(scheduler, goblin, 50);
  setupWander(registry);

  const engine = createEngine(world, registry, scheduler);
  const turn = act(engine);

  assert.equal(turn.entity, goblin);
  assert.equal(turn.waiting, false);
  assert.deepEqual(
    turn.result.resolved.map((a) => a.type),
    ['TakeTurn', 'Move'],
  );
  assert.equal(scheduler.actors.get(goblin), 50 - 100);
  assert.equal(isLocked(engine), false);
});

test('a PlayerControlled actor locks the engine without dispatching anything', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const player = createEntity(world);
  addComponent(world, player, 'PlayerControlled', {});
  addActor(scheduler, player, 50);
  setupWander(registry); // present but must not fire for the player

  const engine = createEngine(world, registry, scheduler);
  const turn = act(engine);

  assert.equal(turn.entity, player);
  assert.equal(turn.waiting, true);
  assert.equal(isLocked(engine), true);
  assert.equal(scheduler.actors.get(player), 50);
});

test('resolvePlayerAction spends cost and unlocks, letting act proceed again', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const player = createEntity(world);
  addComponent(world, player, 'PlayerControlled', {});
  addActor(scheduler, player, 50);

  const engine = createEngine(world, registry, scheduler);
  act(engine); // locks, waiting on the player

  const result = resolvePlayerAction(engine, player, { type: 'Move', entity: player, cost: 40 });

  assert.deepEqual(result.resolved.map((a) => a.type), ['Move']);
  assert.equal(scheduler.actors.get(player), 50 - 40);
  assert.equal(isLocked(engine), false);
});

test('run processes several non-player turns and stops locked at the player turn', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const goblin = createEntity(world);
  const player = createEntity(world);
  addComponent(world, player, 'PlayerControlled', {});
  addActor(scheduler, goblin, 250); // enough budget for a few turns before running dry
  addActor(scheduler, player, 10);
  setupWander(registry);

  const engine = createEngine(world, registry, scheduler);
  const turns = run(engine);

  assert.ok(turns.length >= 1);
  assert.equal(turns[turns.length - 1].entity, player);
  assert.equal(turns[turns.length - 1].waiting, true);
  assert.ok(turns.slice(0, -1).every((t) => t.entity === goblin));
  assert.equal(isLocked(engine), true);
});

test('two turns from the same high-budget actor happen before a lower-budget actor', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(1000);
  const fast = createEntity(world);
  const slow = createEntity(world);
  addActor(scheduler, fast, 250);
  addActor(scheduler, slow, 60);
  setupWander(registry);

  const engine = createEngine(world, registry, scheduler);
  const first = act(engine); // fast: 250 -> 150
  const second = act(engine); // fast: 150 -> 50, still > slow's 60? no, 50 < 60

  assert.equal(first.entity, fast);
  assert.equal(second.entity, fast);

  const third = act(engine);
  assert.equal(third.entity, slow);
});

test('act() threads renderEvents through to a TakeTurn rule', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const goblin = createEntity(world);
  addActor(scheduler, goblin, 50);
  const renderEvents = createRenderEventQueue();

  registerRule(registry, 'wanders-and-animates', 'TakeTurn', (action, ctx) => {
    ctx.enqueueRenderEvent({ kind: 'animation', entity: action.entity });
    return { followOn: [{ type: 'Move', entity: action.entity, cost: 100 }] };
  });

  const engine = createEngine(world, registry, scheduler, undefined, renderEvents);
  act(engine);

  assert.equal(renderEvents.events.length, 1);
  assert.deepEqual(renderEvents.events[0], { kind: 'animation', entity: goblin });
});

test('a Timer entity fires its carried action once its negative budget clears, then self-removes', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const timer = createEntity(world);
  addActor(scheduler, timer, -250);
  addComponent(world, timer, 'Timer', { action: { type: 'EventTimerElapsed', eventId: 'e1', step: 0 } });

  const seen = [];
  registerRule(registry, 'observe-timer', 'EventTimerElapsed', (action) => { seen.push(action); });

  // Alone in the scheduler, the timer is the only actor next() can ever
  // return, so it wins the very first act() regardless of its negative
  // start - the negative budget only delays it relative to competing
  // actors (covered by scriptedEvents.test.js's end-to-end timeUnits case).
  const engine = createEngine(world, registry, scheduler);
  const turn = act(engine);

  assert.equal(turn.entity, timer);
  assert.deepEqual(seen, [{ type: 'EventTimerElapsed', eventId: 'e1', step: 0 }]);
  assert.equal(scheduler.actors.has(timer), false);
  assert.equal(hasComponent(world, timer, 'Timer'), false);
});

test('a Timer entity dispatches its own action instead of a TakeTurn/behaviors pipeline', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const timer = createEntity(world);
  addActor(scheduler, timer, 10);
  addComponent(world, timer, 'Timer', { action: { type: 'EventTimerElapsed' } });
  setupWander(registry); // a TakeTurn rule that would add a Move follow-on, if it ever ran

  const engine = createEngine(world, registry, scheduler);
  const turn = act(engine);

  assert.deepEqual(turn.result.resolved.map((a) => a.type), ['EventTimerElapsed']);
});

test('resolvePlayerAction threads renderEvents through to the dispatched action', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const player = createEntity(world);
  addComponent(world, player, 'PlayerControlled', {});
  addActor(scheduler, player, 50);
  const renderEvents = createRenderEventQueue();

  registerRule(registry, 'move-animates', 'Move', (action, ctx) => {
    ctx.enqueueRenderEvent({ kind: 'animation', entity: action.entity });
  });

  const engine = createEngine(world, registry, scheduler, undefined, renderEvents);
  act(engine); // locks, waiting on the player

  resolvePlayerAction(engine, player, { type: 'Move', entity: player, cost: 40 });

  assert.equal(renderEvents.events.length, 1);
});
