import { createApi } from './api.js';

// core-architecture.md: two independently-versioned slices. This is core's
// own schema version, bumped whenever the shape below changes.
export const CORE_SCHEMA_VERSION = 1;

// Generic stepwise-migration runner, shared by the core/game/plugin slices
// (only the core slice actually has migrations registered yet - the
// mechanism is reusable once a game/plugin defines its own migrations).
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

// serializeGame/plugins are owned by the downstream game, not core -
// core-architecture.md/scripting-api.md's split. Core only knows how to
// serialize its own world/scheduler/rng state; the game slice and each
// plugin's slice are produced by injected hooks.
//
// `plugins` is a list of loaded-plugin descriptors - `{ id,
// pluginDataVersion, serialize(api) }` - one per dynamically-loaded plugin
// (plugins.js's loadPlugins()), generalizing the single serializeGame hook
// to N independently-versioned slices per scripting-api.md's per-plugin
// save-slice design. A plugin's own deserialize hook (see deserialize()
// below) is responsible for running its own migrations if it needs to, the
// same way deserializeGame already receives the raw game slice with no
// migration step run on its behalf by core.
export function serialize(api, { gameDataVersion = 1, serializeGame = () => ({}), plugins = [] } = {}) {
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
    plugins: Object.fromEntries(
      plugins.map(({ id, pluginDataVersion, serialize: serializePlugin }) => [
        id,
        { pluginDataVersion, payload: serializePlugin(api) },
      ]),
    ),
  };
}

// A save requires its full plugin set to load (scripting-api.md) - fails
// hard rather than silently dropping a plugin's data if it isn't currently
// installed, same as every other ambiguous-state question in that doc.
function checkPluginsPresent(dto, registeredPluginIds) {
  for (const pluginId of Object.keys(dto.plugins ?? {})) {
    if (!registeredPluginIds.includes(pluginId)) {
      throw new Error(`save contains a slice for plugin "${pluginId}", which is not currently installed`);
    }
  }
}

export function deserialize(dto, {
  seed = 1,
  platform,
  coreMigrations = {},
  plugins = [],
  deserializeGame,
} = {}) {
  checkPluginsPresent(dto, plugins.map(({ id }) => id));

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

  for (const { id, deserialize: deserializePlugin } of plugins) {
    const slice = dto.plugins?.[id];
    if (slice) deserializePlugin?.(slice, api);
  }

  deserializeGame?.(dto.game);

  return api;
}
