# Data model reference

A living reference for `packages/core`'s actual data shapes — components,
action payloads, save DTOs, and content/asset formats. This is **not**
another `docs/design/*.md` planning-session doc; those are point-in-time
decision records (why a choice was made). This doc tracks the *current,
real* shape of things as implementation defines them.

**Maintenance rule**: update this doc as part of the implementation work
that defines or changes a shape — not speculatively ahead of code. Every
entry below is currently an **illustrative example** sketched in a design
doc, not a committed schema; as real code lands, replace the design-doc
cross-reference with a pointer at the actual source file/type and drop the
"illustrative" tag. A stale entry here is worse than no entry — if
something changes and this doc isn't updated in the same PR, that's a bug
in the PR, not a documentation backlog item.

## Components

| Name | Description | Source | Status |
|---|---|---|---|
| `Position` | `{x, y}` | `core-architecture.md` | illustrative |
| `Health` | `{current, max}` | `core-architecture.md` | illustrative |
| `Inventory` | `{items}` | `core-architecture.md` | illustrative |
| `ExplodesOnDeath` | marker (no data) | `scripting-api.md` | illustrative |
| `Wanders` / `ChasesPlayer` / `Flees` / `Guards` | markers, first-party `TakeTurn` behaviors | `ai-and-behavior.md` | illustrative |
| `EventState` | `{ step }` — multi-step scripted-event progress | `scripting-api.md` | illustrative |
| `PendingUI` | `{ screenId, payload }` — generic core→UI hand-off marker; supersedes the earlier `PendingDialogue`-only concept (`ui-and-input.md`'s `ShowDialogue` is now `PendingUI`'s first built-in consumer) | `custom-ui-and-interactions.md` | illustrative |
| `PlayerControlled` | marker (no data) — distinguishes the player-controlled actor so `engine.js`'s `act()` locks and waits for external input instead of auto-dispatching `TakeTurn` | `packages/core/src/engine.js` | implemented |

## Action types

| Type | Notes | Source | Status |
|---|---|---|---|
| `Move`, `Attack`, `Damage`, `Death` | core's first-party default combat/movement vocabulary — swappable per-encounter, not exclusive (`custom-ui-and-interactions.md`) | `core-architecture.md` | illustrative |
| `OpenDoor` | example non-combat action | `core-architecture.md` | illustrative |
| `TakeTurn` | core-shipped, dispatched per non-player actor's turn; zero time-units cost itself | `ai-and-behavior.md` | illustrative |
| `EnterRegion` | scripted-event trigger example (map-region entry) | `scripting-api.md` | illustrative |
| `EventTimerElapsed` | synthetic action emitted by a scheduled timer entity for `waitFor: { timeUnits }` | `scripting-api.md` | illustrative |
| Author-defined closing actions (`ResolveSkillCheck`, `ResolveBattle`, ...) | naming is author's choice, not core-mandated | `custom-ui-and-interactions.md` | illustrative |
| `cost` field (optional, on any action) | variable per-instance time-units cost (`{ type: 'Move', entity, cost: 100 }`) — `engine.js`'s `act()`/`resolvePlayerAction()` sum `cost` across every action a turn resolves to and spend the total from the scheduler | `packages/core/src/engine.js` | implemented |

## Save DTO shapes

Registry state (registered rules/generators/etc.) is deliberately **not**
part of the save DTO below — it's code, reconstructed by re-running a
game's own `register*` calls at boot, same as any other content. Only
world/scheduler/rng *state* is persisted.

| Shape | Notes | Source | Status |
|---|---|---|---|
| Top-level save | `{ coreSchemaVersion, core, gameDataVersion, game, mods: { [modId]: { modDataVersion, payload } } }` — `core` is `{ nextId, entities, components, scheduler: { roundBudget, actors }, rng: { state } }`; `game`/`mods` are opaque payloads produced by an injected `serializeGame` hook / passed through as-is (nothing produces real mod slices yet — no mod-loading system exists) | `packages/core/src/save.js` | implemented |
| Migration mechanism | `runMigrations(payload, fromVersion, toVersion, migrations)` — sparse stepwise chain keyed by target version, reused by the core slice now and available for game/mod slices once those exist | `packages/core/src/save.js` | implemented |
| Storage backend | `{ save(key, data): Promise<void>, load(key): Promise<data\|undefined> }` — `createMemoryStorage`/`createLocalStorageBackend`/`createFsStorage` (atomic temp-file-then-rename), selected per build target | `packages/core/src/storage.js` | implemented |
| `ZoneDTO` | `{ width, height, cells: string[] (row-major), entities: [{type,x,y,data}] (blueprint placements, not live ECS entities), anchors: [{id,x,y}], logicalLinks: [{id,from:{x,y},to:{x,y}\|{zoneId,x,y},bidirectional}] }` — a template is the same shape, stamped via `stampTemplate` | `packages/core/src/mapgen.js`, `packages/core/src/zoneComposition.js` | implemented |
| Zone diff/overlay | `{ cellOverrides: [{x,y,cell}], entityDiffs: [{op:'add'\|'remove'\|'modify',...}] }` — the one mechanism serving both author overrides and player-mutation saves; applied via `applyDiff` | `packages/core/src/zoneDiff.js` | implemented — diff carrying mod-defined entity types still open, see `BACKLOG.md` |
| Settings slice | keybindings, volume/mixing — persists outside save data, own storage key | `ui-and-input.md`, `audio.md` | illustrative |

## Content/asset formats

| Format | Notes | Source | Status |
|---|---|---|---|
| Tileset entry | `symbol -> { fontFace, codepoint, paletteToken(s) }` | `fonts-and-tilesets.md` | illustrative |
| Palette/theme object | token vocabulary + raw-color escape hatch, one object both render paths read | `rendering.md` | illustrative |
| Font-source calibration record | `{ scale factor, baseline offset, horizontal-centering mode }` | `fonts-and-tilesets.md` | illustrative — derivation formula still open |
| Pixelyph glyph manifest | `{ meta, glyphs }`, `glyphs` keyed by lowercase hex codepoint | `fonts-and-tilesets.md` | **implemented** on the Pixelyph side already |

## Registration & API surface

| Call/shape | Notes | Source | Status |
|---|---|---|---|
| `createApi({ roundBudget, seed, platform })` | the one public inspection/mutation surface every consumer goes through — bound methods over one internal world+registry+scheduler+engine instance, no manual world/registry threading | `packages/core/src/api.js` | implemented |
| `api.register*(id, def, options?)` | `registerRule`/`registerGenerator` are implemented via `createApi`; `registerEntity`, `registerEntityType`, `registerScriptedEvent`, `registerScreen`, `registerSound` don't exist yet — later sessions | `scripting-api.md` and each feature doc | partially implemented |
| Entity/component methods | `createEntity`, `destroyEntity`, `addComponent`, `removeComponent`, `getComponent`, `hasComponent`, `query`, `dispatch` — bound on `createApi()`, same shape `ctx` uses inside rules | `packages/core/src/api.js` | implemented |
| `ctx` query/mutation methods | `hasComponent`, `getComponent`, `findPath`, etc. — `findPath` still illustrative, needs session 20 | `core-architecture.md`, `ai-and-behavior.md` | partially implemented |
| `platform` | `{ unlockAchievement(id) }`, no-op default, injectable at `createApi()` creation — same dependency-injection shape as `storage` | `packaging.md`, `packages/core/src/api.js` | implemented |
| `rng` | seeded PRNG (mulberry32), `rng.state` a plain number so save/load can snapshot/restore it directly | `packages/core/src/rng.js` | implemented |
| `GenerationContext` | `{ rng, params, getNeighborZone }` — `rng` is seeded deterministically from `(worldSeed, zoneId)` (FNV-1a hash into `rng.js`'s `createRng`); `getNeighborZone` is a caller-injected lookup (not core-owned zone storage — zone id stays an opaque caller-defined key, no grid/coordinate system built in `core`) | `packages/core/src/mapgen.js` | implemented |
| `registerGenerator(id, generatorFn)` / `generateZone(registry, args)` / `loadZone(registry, args)` | `generateZone` builds the `GenerationContext` and calls the registered generator; `loadZone` = `generateZone` + `applyDiff`, the seed+diff save-strategy round trip; both bound on `createApi()`, defaulting `worldSeed` to the api's own `seed` | `packages/core/src/mapgen.js`, `packages/core/src/zoneDiff.js` | implemented |
| `stampTemplate` / `carveCellularAutomata` / `connectCorridor` / `runConnectivityPass` | composition primitives generator functions call into; `runConnectivityPass` is the mandatory post-generation reachability pass (physical adjacency + `logicalLinks` edges), auto-connecting unreached stamps and respecting `mayBeIsolated`/`reachableVia` | `packages/core/src/zoneComposition.js` | implemented |
| `ensureTraversable(zone, { entryPoints, stamps?, mode? })` | composable follow-up to `runConnectivityPass` for whatever it doesn't cover — disconnected walkable regions the base algorithm itself produced, not just unreached stamps. `mode: 'prune'` (default) converts them to `'wall'`; `mode: 'connect'` carves a corridor into each instead, preserving the content | `packages/core/src/zoneComposition.js` | implemented |
| `carveBsp(zone, rng, { region?, minPartitionSize?, roomMargin? })` / `bspGenerator` | recursive split-and-carve, region-scoped; connects sibling rooms on the way back up the recursion (self-connecting by construction, no `ensureTraversable` needed). Returns `{ rooms, entryPoint }` | `packages/core/src/bsp.js` | implemented |
| `cellularAutomataGenerator` | thin whole-zone wrapper over `carveCellularAutomata`; prunes disconnected floor pockets via `ensureTraversable({ mode: 'prune' })` by default (`pruneUnreachable: false` opts out) | `packages/core/src/cellularAutomataGenerator.js` | implemented |
| `collapseWfc(zone, rng, { region?, tiles, adjacency, maxRetries? })` / `wfcGenerator` | minimal WFC — author-declared tiles + directed per-direction adjacency rules (no implicit compatibility default), lowest-entropy collapse with forward-checking propagation, contradiction retries from the same seeded rng stream. Region-scoped. `wfcGenerator` uses `ensureTraversable({ mode: 'connect' })` to preserve collapsed content | `packages/core/src/waveFunctionCollapse.js` | implemented — a fuller sample-based WFC (pattern extraction, frequency weighting, backtracking) is backlogged, not built |
| `partitionBiomes(zone, rng, { region?, biomes, seedCount? })` / `layeredBiomeGenerator` | nearest-seed-point (Voronoi-like) base biome-region layer, region-scoped; `layeredBiomeGenerator` applies `params.stamps` as the feature layer, then `ensureTraversable({ mode: 'connect' })` | `packages/core/src/layeredBiome.js` | implemented |
| `params.stamps` on all four built-in generators | `{ template, x, y, rotation?, mayBeIsolated?, reachableVia? }[]`, applied via `stampTemplate` after the generator's own base algorithm runs, uniformly across BSP/CA/WFC/layered-biome | `packages/core/src/bsp.js`, `cellularAutomataGenerator.js`, `waveFunctionCollapse.js`, `layeredBiome.js` | implemented |
