import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import { serialize, deserialize } from '../src/save.js';
import { createMemoryStorage } from '../src/storage.js';

// The story a game author's own node --test file would actually write
// against this public API: no UI, no timers/animation frames, no bespoke
// test harness - just createApi(), run(), serialize()/deserialize(), and
// plain assertions. This is the capstone this whole roadmap item exists
// to support.

function registerWander(api) {
  api.registerRule('wanders', 'TakeTurn', (action) => ({
    followOn: [{ type: 'Move', entity: action.entity, cost: 100 }],
  }));
}

test('a full headless play session survives a save/load round trip with identical continuation', async () => {
  const original = createApi({ roundBudget: 100, seed: 42 });
  registerWander(original);

  const goblin = original.createEntity();
  original.addActor(goblin, 300);
  const player = original.createEntity();
  original.addComponent(player, 'PlayerControlled', {});
  original.addActor(player, 10);

  // Fast-forward several turns with nothing but a synchronous loop - no
  // setTimeout/requestAnimationFrame anywhere in run()'s implementation.
  const firstRunTurns = original.run();
  assert.ok(firstRunTurns.length >= 1);
  assert.equal(original.isLocked(), true);

  // Some gameplay randomness consumed before the save point (e.g. a
  // to-hit roll a real rule would make).
  original.rng.next();

  const storage = createMemoryStorage();
  await storage.save('slot1', serialize(original));
  const dto = await storage.load('slot1');

  // deserialize() only restores world/scheduler/rng state - rules are code,
  // not data, so a fresh boot re-registers content exactly like a real game
  // startup would, then loads the save on top of it.
  const restored = deserialize(dto);
  registerWander(restored);

  assert.equal(restored.scheduler.actors.get(goblin), original.scheduler.actors.get(goblin));
  assert.equal(restored.scheduler.actors.get(player), original.scheduler.actors.get(player));
  assert.equal(restored.rng.state, original.rng.state);
  assert.equal(restored.rng.next(), original.rng.next());

  const originalResult = original.resolvePlayerAction(player, { type: 'Move', entity: player, cost: 10 });
  const restoredResult = restored.resolvePlayerAction(player, { type: 'Move', entity: player, cost: 10 });
  assert.deepEqual(
    restoredResult.resolved.map((a) => a.type),
    originalResult.resolved.map((a) => a.type),
  );

  const originalTurns = original.run();
  const restoredTurns = restored.run();
  assert.deepEqual(
    restoredTurns.map((t) => ({ entity: t.entity, waiting: t.waiting })),
    originalTurns.map((t) => ({ entity: t.entity, waiting: t.waiting })),
  );
});
