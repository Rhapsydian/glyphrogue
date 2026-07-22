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
Session 21 added the rendering foundation: `glyphMetrics.js` (the shared
glyph-metrics contract - `pixelsPerEm`/`unitsPerEm`/`baselineRow`/
`horizontalPadding`/per-glyph `advanceWidth`-`offsetX` - one shared source
for both a canvas and future DOM path to derive cell size from) and
`glyphRenderer.js` (the only module touching `ctx.font`/`ctx.fillStyle`/
`ctx.fillText`); `camera.js` (deadzone+snap scrolling, the world-grid ->
screen-cell -> canvas-pixel coordinate pipeline, map-bounds clamping) -
camera state lives in the rendering layer, not core save/simulation state;
`renderEvents.js` (the render-event buffer: a single sequential FIFO with a
delay/duration-driven sequencer, wired into `actions.js`/`engine.js`/
`api.js` via `ctx.enqueueRenderEvent` so both player actions and AI
`TakeTurn` follow-ons reach it - "confirmed necessary" per the deep review,
since the model can race arbitrarily far ahead of the view); `visibility.js`
(pure FOV/lighting visualization - visible/remembered/unknown
classification plus light blending over session 20's `computeFov`) and
`memory.js` (an optional, swappable first-party `Memory` ECS component
convenience-wiring the pure functions for exploration-memory persistence,
same "first-party but not mandatory" precedent as `behaviors.js`); and
`animation.js` (advance-by-dt tween/transient-effect bookkeeping, pure
functions of an explicit `now` - the actual `requestAnimationFrame` driver
isn't built yet, no browser runtime package exists in this monorepo) plus
`renderLayers.js` (layered redraw: a caller-supplied version-token dirty
check keeps the terrain layer's redraw cost near-zero on quiet frames, the
entity/effects layer resolves tweened positions and drops off-viewport
entities). Canvas-touching code is tested against a fake recording `ctx`
object (asserting the exact ordered draw-call sequence) rather than a real
canvas/DOM dependency.
Session 22 added the palette + fonts/tileset pipeline: `palette.js`
(`createPalette`/`resolveColor` — a curated token vocabulary with a
raw-color escape hatch, plus a gradient descriptor whose own stops may
nest a `{ token }` reference each); `fontSources.js`
(`createFontSourceRegistry`/`registerFontSource` — multi-font-source
calibration, defaults derived from metrics (`unitsPerEm`/`ascender`/
`descender`), not raster measurement, so it stays as unit-testable as
every other `core` module; the calibration reference is pinnable at
registry-creation time via `{ reference }`, independent of registration
order, so e.g. a Pixelyph icon font can be the intended visual standard
regardless of when a monospace fallback gets registered); `tileset.js`
(`registerSymbol`/`resolveSymbol` — the `symbol -> {fontFace, codepoint,
foreground, background}` format, `codepoint` a uniform lowercase hex
string across every font source); `glyphRenderer.js`'s material tinting
(`drawCellBackground`, `drawTileCell` — kept as separate primitives from
`drawGlyphCell` on purpose, leaving room for a future background/glyph
redraw-cadence decoupling; a resolved gradient becomes a real
`ctx.createLinearGradient`); and `pixelyphImport.js`
(`glyphManifestToFontSource`, a pure transform consuming Pixelyph's
already-shipped glyph-manifest export, no file I/O).
Session 23 added a new `packages/input` package — physical input →
input-action pipeline, kept outside `packages/core` on purpose (core stays
a pure state/rules engine with no DOM dependency, and `packages/input`
stays dependency-free in the other direction too): `keymap.js` (device-
tagged keybinding table with rebind/lookup), `captureStack.js` (a minimal
generic push/pop stack gating input actions to the topmost UI surface —
the real screen/dialog/menu stack is a later session's job, built on top
of this), `inputPipeline.js` (the exclusive-capture-stack routing),
`stateNotifier.js` (a coarse subscribe/notify primitive for DOM state
binding), `keyboardSource.js` (event-driven, filters browser auto-repeat),
`gamepadSource.js` (poll+edge-detect, since the Gamepad API has no
press/release events — analog stick input becomes a discrete directional
input action past a deadzone), and `keybindingStorage.js` (settings-slice
persistence, entirely outside world-save data).
265 `node --test` cases passing. See:

- [`DESIGN.md`](./DESIGN.md) — architecture decisions made so far
- [`BACKLOG.md`](./BACKLOG.md) — the roadmap and what's next (session 24)
- [`docs/design/`](./docs/design/) — in-depth design docs, one per topic
- [`docs/data-model.md`](./docs/data-model.md) — living reference for actual data shapes, kept current alongside implementation
- [`docs/session-logs/`](./docs/session-logs/) — one entry per session, goal/decisions/work/deferred items

## Layout

```
packages/
  core/     the runtime engine — implementation started (session 14): world.js, registry.js,
            actions.js, scheduler.js, engine.js, api.js, save.js, storage.js, rng.js,
            mapgen.js, zoneComposition.js, zoneDiff.js, bsp.js, cellularAutomataGenerator.js,
            waveFunctionCollapse.js, layeredBiome.js, fov.js, pathfinding.js, behaviors.js,
            glyphMetrics.js, glyphRenderer.js, camera.js, renderEvents.js, visibility.js,
            memory.js, animation.js, renderLayers.js, palette.js, fontSources.js, tileset.js,
            pixelyphImport.js
            under src/, tests under test/
  input/    physical input → input-action pipeline — implementation started (session 23): keymap.js,
            captureStack.js, inputPipeline.js, stateNotifier.js, keyboardSource.js, gamepadSource.js,
            keybindingStorage.js, kept outside core and dependency-free
            under src/, tests under test/
  editor/   dev-time tools (map editor, tileset editor, scripting console) — not started, never ships in production
  cli/      create-glyphrogue-game scaffolding tool — not started
docs/design/  in-depth design docs, one per deep-dive planning session
docs/session-logs/  one log per session
```
