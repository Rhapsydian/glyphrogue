import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, getComponent } from '../src/world.js';
import { createRegistry } from '../src/registry.js';
import { dispatch } from '../src/actions.js';
import { registerScriptedEvent, getScriptedEvent } from '../src/scriptedEvents.js';
import { createApi } from '../src/api.js';

function trackedEntity(world, id) {
  for (const [entity, data] of world.components.get('ScriptedEvent') ?? []) {
    if (data.id === id) return entity;
  }
  return undefined;
}

test('a simple single-do-step event fires its follow-ons on trigger and then cleans itself up', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerScriptedEvent(registry, 'welcome-banner', {
    trigger: { action: 'EnterRegion', region: 'town' },
    steps: [
      { do: [{ type: 'ShowDialogue', text: 'Welcome!' }] },
    ],
  });

  const result = dispatch(world, registry, { type: 'EnterRegion', region: 'town', entity: 1 });

  assert.deepEqual(result.resolved.map((a) => a.type), ['EnterRegion', 'ShowDialogue']);
  assert.equal(trackedEntity(world, 'welcome-banner'), undefined);
});

test('a trigger with non-matching fields does not start the event', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerScriptedEvent(registry, 'welcome-banner', {
    trigger: { action: 'EnterRegion', region: 'town' },
    steps: [{ do: [{ type: 'ShowDialogue' }] }],
  });

  const result = dispatch(world, registry, { type: 'EnterRegion', region: 'other-place' });

  assert.deepEqual(result.resolved.map((a) => a.type), ['EnterRegion']);
});

test('a multi-step event with an action-match waitFor pauses until the wait matches', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerScriptedEvent(registry, 'goblin-ambush', {
    trigger: { action: 'EnterRegion', region: 'goblin-camp' },
    steps: [
      { do: [{ type: 'SpawnEntity', entityType: 'goblin', count: 3 }, { type: 'ShowDialogue' }] },
      { waitFor: { action: 'DefeatAll', entityType: 'goblin' } },
      { do: [{ type: 'UnlockDoor', doorId: 'camp-gate' }] },
    ],
  });

  const started = dispatch(world, registry, { type: 'EnterRegion', region: 'goblin-camp' });
  assert.deepEqual(
    started.resolved.map((a) => a.type),
    ['EnterRegion', 'SpawnEntity', 'ShowDialogue'],
  );

  const tracker = trackedEntity(world, 'goblin-ambush');
  assert.ok(tracker !== undefined);
  assert.equal(getComponent(world, tracker, 'EventState').step, 1);

  // A DefeatAll for the wrong entityType doesn't advance the event.
  const wrongMatch = dispatch(world, registry, { type: 'DefeatAll', entityType: 'rat' });
  assert.deepEqual(wrongMatch.resolved.map((a) => a.type), ['DefeatAll']);
  assert.equal(getComponent(world, tracker, 'EventState').step, 1);

  const finished = dispatch(world, registry, { type: 'DefeatAll', entityType: 'goblin' });
  assert.deepEqual(finished.resolved.map((a) => a.type), ['DefeatAll', 'UnlockDoor']);
  assert.equal(trackedEntity(world, 'goblin-ambush'), undefined);
});

test('re-triggering an in-progress event is a no-op', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerScriptedEvent(registry, 'goblin-ambush', {
    trigger: { action: 'EnterRegion', region: 'goblin-camp' },
    steps: [
      { do: [{ type: 'SpawnEntity' }] },
      { waitFor: { action: 'DefeatAll' } },
      { do: [{ type: 'UnlockDoor' }] },
    ],
  });

  dispatch(world, registry, { type: 'EnterRegion', region: 'goblin-camp' });
  const firstTracker = trackedEntity(world, 'goblin-ambush');

  const reentered = dispatch(world, registry, { type: 'EnterRegion', region: 'goblin-camp' });
  assert.deepEqual(reentered.resolved.map((a) => a.type), ['EnterRegion']);
  assert.equal(trackedEntity(world, 'goblin-ambush'), firstTracker);
});

test('a completed event can start fresh on a later trigger match', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerScriptedEvent(registry, 'goblin-ambush', {
    trigger: { action: 'EnterRegion', region: 'goblin-camp' },
    steps: [{ do: [{ type: 'SpawnEntity' }] }],
  });

  dispatch(world, registry, { type: 'EnterRegion', region: 'goblin-camp' });
  assert.equal(trackedEntity(world, 'goblin-ambush'), undefined);

  const secondRun = dispatch(world, registry, { type: 'EnterRegion', region: 'goblin-camp' });
  assert.deepEqual(secondRun.resolved.map((a) => a.type), ['EnterRegion', 'SpawnEntity']);
});

test('waitFor supports a predicate escape hatch alongside field matching', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerScriptedEvent(registry, 'timed-check', {
    trigger: { action: 'Start' },
    steps: [
      { waitFor: { action: 'Check', predicate: (action) => action.value > 10 } },
      { do: [{ type: 'Resolved' }] },
    ],
  });

  dispatch(world, registry, { type: 'Start' });
  const tracker = trackedEntity(world, 'timed-check');

  const tooLow = dispatch(world, registry, { type: 'Check', value: 5 });
  assert.deepEqual(tooLow.resolved.map((a) => a.type), ['Check']);
  assert.equal(getComponent(world, tracker, 'EventState').step, 0);

  const highEnough = dispatch(world, registry, { type: 'Check', value: 20 });
  assert.deepEqual(highEnough.resolved.map((a) => a.type), ['Check', 'Resolved']);
});

// A timer competing against a real actor: goblin starts at budget 60 and
// spends 100/turn wandering, so it wins the first 3 act() calls (60, -40+100
// top-up=60, -40+100=60 again) before the timer's -150 (topped up to 50 on
// the 3rd top-up) finally out-budgets it on the 4th call. A timer alone in
// the scheduler would win on the very first act() regardless of its
// negative start - the wait is only meaningful relative to other actors
// also competing for turns, same as any other budget in this scheduler.
function setUpFuseWithCompetingActor(api, timeUnits) {
  const goblin = api.createEntity();
  api.addActor(goblin, 60);
  api.registerRule('wanders', 'TakeTurn', (action) => ({
    followOn: [{ type: 'Move', entity: action.entity, cost: 100 }],
  }));

  api.registerScriptedEvent('slow-fuse', {
    trigger: { action: 'Start' },
    steps: [
      { waitFor: { timeUnits } },
      { do: [{ type: 'Explode' }] },
    ],
  });

  const exploded = [];
  api.registerRule('watch-explode', 'Explode', () => { exploded.push(true); });
  api.dispatch({ type: 'Start' });
  return exploded;
}

test('a timeUnits waitFor schedules a Timer and advances once the engine\'s act() loop fires it', () => {
  const api = createApi({ roundBudget: 100 });
  const exploded = setUpFuseWithCompetingActor(api, 150);

  for (let i = 0; i < 4; i++) api.act();

  assert.deepEqual(exploded, [true]);
});

test('a timeUnits wait does not advance before its scheduled time', () => {
  const api = createApi({ roundBudget: 100 });
  const exploded = setUpFuseWithCompetingActor(api, 150);

  for (let i = 0; i < 3; i++) api.act();

  assert.deepEqual(exploded, []);
});

test('getScriptedEvent returns the raw registered definition', () => {
  const registry = createRegistry();
  const def = { trigger: { action: 'Start' }, steps: [{ do: [] }] };

  registerScriptedEvent(registry, 'noop-event', def);

  assert.deepEqual(getScriptedEvent(registry, 'noop-event'), def);
});
