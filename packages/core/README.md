# @glyphrogue/core

The runtime engine — ships in every production game built with Glyphrogue.
A pure state/rules engine with no DOM dependency: rendering, input, and
audio *playback backends* live here, but rendering to a real `<canvas>`,
capturing real keyboard/gamepad events, and screen/menu lifecycle are a
consuming game's job (or `@glyphrogue/input`'s/`@glyphrogue/editor`'s),
wired up against the primitives this package exports. Raw ESM `src/`, no
build step, no TypeScript, zero runtime dependencies. See
`../../docs/design/core-architecture.md` for the full design and
`../../docs/data-model.md` for the shape of every DTO this package
produces/consumes.

## Usage

```js
import { createApi } from '@glyphrogue/core';

const api = createApi();
const player = api.createEntity();
api.addComponent(player, 'Position', { x: 0, y: 0 });
```

`createApi()` is the one entry point most consumers need — a bound
inspection/mutation surface over ECS state, the action/rule pipeline, the
turn scheduler, save/load, and every `register*` call a plugin uses.

## What's in here

- **ECS + action/rule pipeline** (`world.js`, `registry.js`, `actions.js`)
  — entities/components, the generic id/override/dependency-ordered
  registration mechanism every `register*` call reuses, and `dispatch`/
  `dispatchExclusive` for resolving an action through registered rules.
- **Turn scheduler + engine loop** (`scheduler.js`, `engine.js`) — a
  fixed-per-round energy budget, `act`/`lock`/`unlock`/`run`,
  `resolvePlayerAction`.
- **Public API + save/load** (`api.js`, `save.js`, `storage.js`, `rng.js`)
  — `createApi()`, versioned serialize/deserialize with sparse stepwise
  migrations, memory/localStorage/atomic-fs storage backends, seeded
  deterministic RNG.
- **Map generation** (`mapgen.js`, `zoneComposition.js`, `zoneDiff.js`,
  `bsp.js`, `cellularAutomataGenerator.js`, `waveFunctionCollapse.js`,
  `layeredBiome.js`) — `registerGenerator`/`generateZone`, region-scoped
  composable primitives (BSP, cellular automata, minimal WFC, layered
  biome) each with a thin whole-zone generator wrapper, template
  stamping, the mandatory connectivity pass, and the seed+diff save
  strategy.
- **AI & pathfinding** (`fov.js`, `pathfinding.js`, `behaviors.js`) —
  recursive shadowcasting FOV, A* pathfinding, and the four first-party
  `TakeTurn` rules (`Wanders`/`ChasesPlayer`/`Flees`/`Guards`).
- **Rendering primitives** (`glyphMetrics.js`, `camera.js`,
  `renderEvents.js`, `visibility.js`, `memory.js`, `animation.js`,
  `glyphRenderer.js`, `renderLayers.js`) — the shared glyph-metrics
  contract, deadzone+snap camera scrolling, the sequential render-event
  buffer, FOV/lighting visualization, tween/effect bookkeeping, and
  layered canvas redraw. Canvas-touching code is tested against a fake
  recording `ctx`, not a real DOM.
- **Palette + fonts/tileset pipeline** (`palette.js`, `fontSources.js`,
  `tileset.js`, `pixelyphImport.js`) — token/gradient color resolution,
  multi-font-source metrics-based calibration, symbol definitions, and a
  Pixelyph glyph-manifest import transform.
- **Screens, sound, audio** (`screen.js`, `sound.js`, `audio.js`,
  `audioLoader.js`, `audioSettings.js`) — `registerScreen`/`openScreen`
  (the pause contract expressed entirely via `lock()`/`unlock()`, no new
  primitive), action-triggered sound enqueuing baked into `dispatch()`,
  Web Audio playback, an optional decode/cache convenience, and mixing
  settings persistence.
- **Content definitions + scripted events** (`definitions.js`,
  `scriptedEvents.js`) — `registerEntity`/`registerEntityType`/
  `instantiateEntity`, and action-match/`timeUnits` scripted event
  sequences.
- **Plugin system** (`plugins.js`, `recordingApi.js`,
  `generatorPlugins.js`, `behaviorPlugins.js`, `servicePlugins.js`,
  `corePlugins.js`, `ruleOverrides.js`) — `loadPlugins` (Content and
  Service plugin kinds, dependency-ordered, semver-range validated), a
  manifest-derivation recording API for tooling, first-party content
  wrapped as Content plugins, and the runtime override dispatcher backing
  the editor's behavior wizard.

## Status

Published at `0.1.0`. All deep-dive planning roadmap topics, the
`packages/core` implementation roadmap (sessions 14–25), and the plugin
reconciliation roadmap are complete — see `../../BACKLOG.md`. 357 tests
(`node --test`).
