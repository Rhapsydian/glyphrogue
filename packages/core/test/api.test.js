import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

test('a goblin-wanders-and-player-acts scenario driven entirely through createApi()', () => {
  const api = createApi({ roundBudget: 100 });

  const goblin = api.createEntity();
  api.addActor(goblin, 250);

  const player = api.createEntity();
  api.addComponent(player, 'PlayerControlled', {});
  api.addActor(player, 10);

  api.registerRule('wanders', 'TakeTurn', (action) => ({
    followOn: [{ type: 'Move', entity: action.entity, cost: 100 }],
  }));

  const turns = api.run();

  assert.ok(turns.length >= 1);
  assert.equal(turns[turns.length - 1].entity, player);
  assert.equal(turns[turns.length - 1].waiting, true);
  assert.equal(api.isLocked(), true);

  const result = api.resolvePlayerAction(player, { type: 'Move', entity: player, cost: 5 });
  assert.deepEqual(result.resolved.map((a) => a.type), ['Move']);
  assert.equal(api.isLocked(), false);
});

test('platform.unlockAchievement defaults to a harmless no-op', () => {
  const api = createApi();
  assert.doesNotThrow(() => api.platform.unlockAchievement('first-blood'));
});

test('an injected platform implementation is called with the right id', () => {
  const unlocked = [];
  const api = createApi({ platform: { unlockAchievement: (id) => unlocked.push(id) } });

  api.platform.unlockAchievement('first-blood');

  assert.deepEqual(unlocked, ['first-blood']);
});

test('two createApi({ seed }) instances produce the identical rng sequence', () => {
  const a = createApi({ seed: 1 });
  const b = createApi({ seed: 1 });

  const sequenceA = Array.from({ length: 5 }, () => a.rng.next());
  const sequenceB = Array.from({ length: 5 }, () => b.rng.next());

  assert.deepEqual(sequenceA, sequenceB);
});

test('different seeds produce different rng sequences', () => {
  const a = createApi({ seed: 1 });
  const b = createApi({ seed: 2 });

  assert.notEqual(a.rng.next(), b.rng.next());
});
