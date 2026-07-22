import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import { serialize, deserialize, runMigrations, CORE_SCHEMA_VERSION } from '../src/save.js';

function buildSampleApi() {
  const api = createApi({ roundBudget: 100, seed: 7 });

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 3, y: 4 });
  api.addComponent(goblin, 'Health', { current: 5, max: 5 });
  api.addActor(goblin, 60);

  const player = api.createEntity();
  api.addComponent(player, 'PlayerControlled', {});
  api.addActor(player, 10);

  api.rng.next();
  api.rng.next(); // advance state a bit so restore has something to prove

  return { api, goblin, player };
}

test('serialize produces a versioned DTO with core/game/mods slices', () => {
  const { api } = buildSampleApi();

  const dto = serialize(api);

  assert.equal(dto.coreSchemaVersion, CORE_SCHEMA_VERSION);
  assert.equal(dto.gameDataVersion, 1);
  assert.deepEqual(dto.game, {});
  assert.deepEqual(dto.mods, {});
  assert.ok(Array.isArray(dto.core.entities));
  assert.equal(typeof dto.core.rng.state, 'number');
});

test('serialize -> deserialize round trip produces an equivalent, independently-playable api', () => {
  const { api: original, goblin, player } = buildSampleApi();

  const dto = serialize(original);
  const restored = deserialize(dto);

  assert.deepEqual([...restored.world.entities].sort(), [...original.world.entities].sort());
  assert.deepEqual(restored.getComponent(goblin, 'Position'), { x: 3, y: 4 });
  assert.deepEqual(restored.getComponent(goblin, 'Health'), { current: 5, max: 5 });
  assert.equal(restored.scheduler.actors.get(goblin), original.scheduler.actors.get(goblin));
  assert.equal(restored.scheduler.actors.get(player), original.scheduler.actors.get(player));
  assert.equal(restored.rng.state, original.rng.state);

  // Functional continuation: the restored rng produces the same next value
  // the original would have, and a further engine call behaves the same.
  assert.equal(restored.rng.next(), original.rng.next());

  const turn = restored.act();
  assert.equal(turn.entity, goblin);
});

test('a custom serializeGame hook is used to populate the game slice', () => {
  const { api } = buildSampleApi();

  const dto = serialize(api, { gameDataVersion: 3, serializeGame: () => ({ questFlags: { metGoblin: true } }) });

  assert.equal(dto.gameDataVersion, 3);
  assert.deepEqual(dto.game, { questFlags: { metGoblin: true } });
});

test('deserializeGame hook receives the game slice on load', () => {
  const { api } = buildSampleApi();
  const dto = serialize(api, { serializeGame: () => ({ questFlags: { metGoblin: true } }) });

  let received;
  deserialize(dto, { deserializeGame: (game) => { received = game; } });

  assert.deepEqual(received, { questFlags: { metGoblin: true } });
});

test('serialize populates a slice per mod using its own serialize hook', () => {
  const { api } = buildSampleApi();
  const mods = [{ id: 'goblin-pack', modDataVersion: 1, serialize: () => ({ tamed: 3 }) }];

  const dto = serialize(api, { mods });

  assert.deepEqual(dto.mods, { 'goblin-pack': { modDataVersion: 1, payload: { tamed: 3 } } });
});

test('loading a save with an unknown mod slice throws', () => {
  const { api } = buildSampleApi();
  const mods = [{ id: 'goblin-pack', modDataVersion: 1, serialize: () => ({}) }];
  const dto = serialize(api, { mods });

  assert.throws(
    () => deserialize(dto, { mods: [] }),
    /goblin-pack/,
  );
});

test('loading a save whose mod slice matches an installed mod calls its deserialize hook', () => {
  const { api } = buildSampleApi();
  const mods = [{ id: 'goblin-pack', modDataVersion: 1, serialize: () => ({ tamed: 3 }) }];
  const dto = serialize(api, { mods });

  let received;
  deserialize(dto, {
    mods: [{ id: 'goblin-pack', deserialize: (slice) => { received = slice; } }],
  });

  assert.deepEqual(received, { modDataVersion: 1, payload: { tamed: 3 } });
});

test('a mod present at load time but absent from the save is simply skipped, not an error', () => {
  const { api } = buildSampleApi();
  const dto = serialize(api);

  let called = false;
  assert.doesNotThrow(() => deserialize(dto, {
    mods: [{ id: 'goblin-pack', deserialize: () => { called = true; } }],
  }));
  assert.equal(called, false);
});

test('runMigrations applies a sparse stepwise chain in order', () => {
  const migrations = {
    2: (payload) => ({ ...payload, step: [...(payload.step ?? []), 'v1-to-v2'] }),
    3: (payload) => ({ ...payload, step: [...(payload.step ?? []), 'v2-to-v3'] }),
  };

  const result = runMigrations({ step: [] }, 1, 3, migrations);

  assert.deepEqual(result.step, ['v1-to-v2', 'v2-to-v3']);
});

test('runMigrations is a no-op when fromVersion already equals toVersion', () => {
  const result = runMigrations({ untouched: true }, 1, 1, {});
  assert.deepEqual(result, { untouched: true });
});

test('runMigrations throws when a required step has no registered migration', () => {
  assert.throws(() => runMigrations({}, 1, 2, {}), /no migration registered/);
});

test('deserialize runs coreMigrations before restoring state', () => {
  const legacyDto = {
    coreSchemaVersion: 0,
    core: {
      nextId: 2,
      entities: [1],
      components: {},
      scheduler: { roundBudget: 999, actors: { 1: 50 } },
      rng: { state: 42 },
    },
    gameDataVersion: 1,
    game: {},
    mods: {},
  };

  const coreMigrations = {
    1: (payload) => ({ ...payload, scheduler: { ...payload.scheduler, roundBudget: 100 } }),
  };

  const restored = deserialize(legacyDto, { coreMigrations });

  assert.equal(restored.scheduler.roundBudget, 100);
  assert.equal(restored.scheduler.actors.get(1), 50);
});
