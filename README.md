# Glyphrogue

A web-based game engine for ASCII/glyph-driven roguelikes, in the spirit of
*Caves of Qud*. Monospace/pixel-font glyph rendering, a full dev-time
toolchain (map editor, tileset tools, scripting console) that stays out of
production builds, and support for static HTML, GitHub Pages, itch.io, and a
Steam-compatible Electron desktop build.

The research & planning phase is complete, and **`packages/core`
implementation is underway**: sessions 14-17 of the roadmap are done —
npm-workspaces scaffolding, a purpose-built ECS (entity/component) layer,
the generic registration mechanism, the action/rule dispatch pipeline
(additive and priority-based exclusive resolution), the time-units
scheduler, the engine loop (`lock`/`unlock`/`act`/`run`) with `TakeTurn`
dispatch for non-player actors, the public `createApi()` surface every
consumer goes through, versioned save DTOs with a stepwise migration
mechanism, a storage backend abstraction (memory/localStorage/filesystem,
atomic writes), a no-op-default `platform` capability, and
headless/deterministic testability (seeded RNG, a `node --test`-friendly
save/load/continue loop with no timers involved). Session 18 added the map
generation interface and primitives: `registerGenerator`/`generateZone`
with per-zone deterministic seeding, the `GenerationContext` (caller-
injected neighbor-zone lookup, no core-owned zone storage), the composition
primitives (`stampTemplate`, `carveCellularAutomata`, `connectCorridor`,
the mandatory `runConnectivityPass`), and the seed+diff zone save strategy
(`applyDiff`/`loadZone`). Session 19 added the four built-in map generation
algorithms — BSP, cellular automata, minimal WFC, and layered biome — each
exposed as a region-scoped composable primitive (`carveBsp`,
`carveCellularAutomata`, `collapseWfc`, `partitionBiomes`) with a thin
whole-zone generator wrapper on top, so an author can compose more than one
algorithm into a single zone. `ensureTraversable` is a new shared
composition primitive (prune or connect disconnected walkable regions the
mandatory connectivity pass doesn't cover) used by three of the four.
Session 20 added AI & behavior: a shared shadowcasting/FOV primitive
(`computeFov`) and a shared pathfinding primitive (`findPath`), both taking
a caller-injected walkability/opacity query (core still owns no grid/zone
storage) that's wired in once via `createApi({ isWalkable, isOpaque })` —
the same dependency-injection shape as `platform`/`storage`/`rng` — so any
`TakeTurn` rule gets working `ctx.findPath`/`ctx.computeFov` for free.
Also shipped the four first-party `TakeTurn` behaviors (`wandersRule`,
`chasesPlayerRule`, `fleesRule`, `guardsRule`) with default priorities
(`Flees` > `Guards` > `ChasesPlayer` > `Wanders`), and `Position {x, y}` is
now a real (no longer illustrative-only) core convention.
156 `node --test` cases passing. See:

- [`DESIGN.md`](./DESIGN.md) — architecture decisions made so far
- [`BACKLOG.md`](./BACKLOG.md) — the roadmap and what's next (session 21)
- [`docs/design/`](./docs/design/) — in-depth design docs, one per topic
- [`docs/data-model.md`](./docs/data-model.md) — living reference for actual data shapes, kept current alongside implementation
- [`docs/session-logs/`](./docs/session-logs/) — one entry per session, goal/decisions/work/deferred items

## Layout

```
packages/
  core/     the runtime engine — implementation started (session 14): world.js, registry.js,
            actions.js, scheduler.js, engine.js, api.js, save.js, storage.js, rng.js,
            mapgen.js, zoneComposition.js, zoneDiff.js, bsp.js, cellularAutomataGenerator.js,
            waveFunctionCollapse.js, layeredBiome.js, fov.js, pathfinding.js, behaviors.js
            under src/, tests under test/
  editor/   dev-time tools (map editor, tileset editor, scripting console) — not started, never ships in production
  cli/      create-glyphrogue-game scaffolding tool — not started
docs/design/  in-depth design docs, one per deep-dive planning session
docs/session-logs/  one log per session
```
