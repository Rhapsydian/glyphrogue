# Glyphrogue

A web-based game engine for ASCII/glyph-driven roguelikes, in the spirit of
*Caves of Qud*. Monospace/pixel-font glyph rendering, a full dev-time
toolchain (map editor, tileset/calibration editor, content browser,
composition wizard, config UI) that stays out of production builds, and
support for static HTML, GitHub Pages, itch.io, and a Steam-compatible
Electron desktop build.

The research & planning phase is complete, and **`packages/core`
implementation is complete** (sessions 14-25 of the roadmap): sessions
14-17 —
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
Session 24 added custom screens and audio, both needing **no new engine
primitive**: `screen.js` (`registerScreen`/`getScreen`, the generic
core→UI hand-off registration) plus `api.openScreen`/`api.closeScreen`,
which express the screen pause contract entirely in terms of the existing
`lock()`/`unlock()`/`resolvePlayerAction` — opening a screen sets a
`PendingUI({ screenId, payload })` marker and holds `lock()` open for the
screen's whole lifetime, closing it dispatches one ordinary Action through
the normal pipeline exactly like any other locked-turn resume. `sound.js`
(`registerSound`) is reactive, not core-triggered: `dispatch()`/
`dispatchExclusive()` (`actions.js`) now automatically enqueue a render
event for every resolved action matching a registered sound's
`trigger`/`match`, reusing the same render-event buffer rendering already
needed. `audio.js` (`playSound`/`playMusic`) is the sole module touching
real `AudioContext`/`AudioBufferSourceNode`/`GainNode` calls, mirroring
`glyphRenderer.js`'s posture — takes an already-decoded `AudioBuffer`, no
swappable backend (Web Audio is identical across every build target).
`audioLoader.js` is a separate, optional `decodeAudioData`+cache
convenience (takes an already-fetched `ArrayBuffer`; `core` still never
performs `fetch` itself). `audioSettings.js` persists master/music/sfx
mixing volume as its own settings slice, reusing the existing storage
backends exactly the way `packages/input`'s keybinding persistence already
does.
Session 25 (the roadmap's last item) added `definitions.js`
(`registerEntity`/`registerEntityType`/`instantiateEntity` — inert
component-bag definitions, plus sugar decomposing into one `registerEntity`
call and N `registerRule` calls auto-scoped to their own instances via an
injected `EntityType` component); `scriptedEvents.js`
(`registerScriptedEvent`/`waitFor` — a step list compiles down to a trigger
rule plus one rule per `waitFor` step, progress tracked in `EventState` on a
dedicated tracking entity created lazily on first trigger match; a
`timeUnits` wait schedules a `Timer` entity — an ordinary scheduler actor
with a negative initial budget, **no new engine primitive**); `mods.js`
(mod module format + dependency-ordered loading reusing the existing
generic topological sort, hand-rolled `^`/`~`/exact semver range checking
to stay at zero runtime dependencies); and `recordingApi.js` (the
manifest-derivation mechanism — a mod's `register(api)` run against a
recording implementation instead of a real one, for editor content-browsing
or load-time validation without hand-authoring a manifest).
323 `node --test` cases passing (295 `packages/core`, 28 `packages/input`).

Session 26 surveyed and designed `packages/editor` (the dev-time
companion tooling above — no implementation yet, no source touched):
[`docs/design/editor.md`](docs/design/editor.md) covers the hot-reload
harness, map editor, tileset/calibration editor, content browser,
composition wizard, config UI, and the two `core` extensions the tooling
needs (`registerRule`'s declarative `components` filter, generator
`paramsDefaults`). `BACKLOG.md`'s new "packages/editor design roadmap"
scopes the 8 implementation sessions ahead, starting with a `core`-only
mechanisms session.

See:

- [`DESIGN.md`](./DESIGN.md) — architecture decisions made so far
- [`BACKLOG.md`](./BACKLOG.md) — what's next (`packages/editor` implementation roadmap, 8 sessions scoped)
- [`docs/design/`](./docs/design/) — in-depth design docs, one per topic
- [`docs/data-model.md`](./docs/data-model.md) — living reference for actual data shapes, kept current alongside implementation
- [`docs/session-logs/`](./docs/session-logs/) — one entry per session, goal/decisions/work/deferred items

## Layout

```
packages/
  core/     the runtime engine — implementation complete (sessions 14-25): world.js, registry.js,
            actions.js, scheduler.js, engine.js, api.js, save.js, storage.js, rng.js,
            mapgen.js, zoneComposition.js, zoneDiff.js, bsp.js, cellularAutomataGenerator.js,
            waveFunctionCollapse.js, layeredBiome.js, fov.js, pathfinding.js, behaviors.js,
            glyphMetrics.js, glyphRenderer.js, camera.js, renderEvents.js, visibility.js,
            memory.js, animation.js, renderLayers.js, palette.js, fontSources.js, tileset.js,
            pixelyphImport.js, screen.js, sound.js, audio.js, audioLoader.js, audioSettings.js,
            definitions.js, scriptedEvents.js, mods.js, recordingApi.js
            under src/, tests under test/
  input/    physical input → input-action pipeline — implementation started (session 23): keymap.js,
            captureStack.js, inputPipeline.js, stateNotifier.js, keyboardSource.js, gamepadSource.js,
            keybindingStorage.js, kept outside core and dependency-free
            under src/, tests under test/
  editor/   dev-time companion tools (map editor, tileset/calibration editor, content browser,
            composition wizard, config UI) — designed (session 26, docs/design/editor.md),
            implementation not yet started, never ships in production
  cli/      create-glyphrogue-game scaffolding tool — not started
docs/design/  in-depth design docs, one per deep-dive planning session
docs/session-logs/  one log per session
```
