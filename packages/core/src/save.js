import { createApi } from './api.js';

// core-architecture.md: two independently-versioned slices. This is core's
// own schema version, bumped whenever the shape below changes.
export const CORE_SCHEMA_VERSION = 1;

// Generic stepwise-migration runner, shared by the core/game/mod slices
// (only the core slice actually has migrations registered yet - the
// mechanism is reusable once a game/mod defines its own migrations).
// `migrations` is keyed by the *target* version each step reaches, so a
// sparse chain (e.g. only { 3: fn } if versions 1-2 never shipped a real
// schema change) works without empty placeholder steps.
export function runMigrations(payload, fromVersion, toVersion, migrations = {}) {
  let current = payload;
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    const migrate = migrations[v];
    if (!migrate) {
      throw new Error(`no migration registered to reach schema version ${v} (from ${v - 1})`);
    }
    current = migrate(current);
  }
  return current;
}

function componentsToPlain(components) {
  return Object.fromEntries(
    [...components].map(([type, store]) => [type, Object.fromEntries(store)]),
  );
}

function componentsFromPlain(plain) {
  return new Map(
    Object.entries(plain).map(([type, store]) => [
      type,
      new Map(Object.entries(store).map(([entity, data]) => [Number(entity), data])),
    ]),
  );
}

// serializeGame/mods are owned by the downstream game, not core -
// core-architecture.md/scripting-api.md's split. Core only knows how to
// serialize its own world/scheduler/rng state; the game slice and each
// mod's slice are produced by injected hooks.
//
// `mods` is a list of loaded-mod descriptors - `{ id, modDataVersion,
// serialize(api) }` - one per dynamically-loaded mod (mods.js's
// loadMods()), generalizing the single serializeGame hook to N
// independently-versioned slices per scripting-api.md's per-mod save-slice
// design. A mod's own deserialize hook (see deserialize() below) is
// responsible for running its own migrations if it needs to, the same way
// deserializeGame already receives the raw game slice with no migration
// step run on its behalf by core.
export function serialize(api, { gameDataVersion = 1, serializeGame = () => ({}), mods = [] } = {}) {
  return {
    coreSchemaVersion: CORE_SCHEMA_VERSION,
    core: {
      nextId: api.world.nextId,
      entities: [...api.world.entities],
      components: componentsToPlain(api.world.components),
      scheduler: {
        roundBudget: api.scheduler.roundBudget,
        actors: Object.fromEntries(api.scheduler.actors),
      },
      rng: { state: api.rng.state },
    },
    gameDataVersion,
    game: serializeGame(api),
    mods: Object.fromEntries(
      mods.map(({ id, modDataVersion, serialize: serializeMod }) => [
        id,
        { modDataVersion, payload: serializeMod(api) },
      ]),
    ),
  };
}

// A save requires its full mod set to load (scripting-api.md) - fails hard
// rather than silently dropping a mod's data if it isn't currently
// installed, same as every other ambiguous-state question in that doc.
function checkModsPresent(dto, registeredModIds) {
  for (const modId of Object.keys(dto.mods ?? {})) {
    if (!registeredModIds.includes(modId)) {
      throw new Error(`save contains a slice for mod "${modId}", which is not currently installed`);
    }
  }
}

export function deserialize(dto, {
  seed = 1,
  platform,
  coreMigrations = {},
  mods = [],
  deserializeGame,
} = {}) {
  checkModsPresent(dto, mods.map(({ id }) => id));

  const core = runMigrations(dto.core, dto.coreSchemaVersion, CORE_SCHEMA_VERSION, coreMigrations);

  const api = createApi({ seed, platform });

  // Mutate the existing world/scheduler in place (not reassigned wholesale)
  // so engine.js's own captured references to the same objects stay valid.
  api.world.nextId = core.nextId;
  api.world.entities = new Set(core.entities);
  api.world.components = componentsFromPlain(core.components);

  api.scheduler.roundBudget = core.scheduler.roundBudget;
  api.scheduler.actors = new Map(
    Object.entries(core.scheduler.actors).map(([entity, budget]) => [Number(entity), budget]),
  );

  api.rng.state = core.rng.state;

  for (const { id, deserialize: deserializeMod } of mods) {
    const slice = dto.mods?.[id];
    if (slice) deserializeMod?.(slice, api);
  }

  deserializeGame?.(dto.game);

  return api;
}
