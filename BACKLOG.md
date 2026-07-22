# Glyphrogue backlog

## NEXT SESSION

The original 8-topic deep-dive planning roadmap finished at session 9
(packaging). Sessions 10-12 added three more planning passes beyond that
original roadmap — custom UI surfaces & interaction hooks, audio, and AI &
behavior (roadmap items 9-11 below) — prompted by gaps found while
reviewing the completed roadmap rather than by pre-planned topics. Session
13 was a deep coherence-review pass across all 11 docs (see the two
"surfaced during the session-13 deep review" deferred items below, plus
corrections and resolutions folded directly into `rendering.md`,
`audio.md`, `ai-and-behavior.md`, `custom-ui-and-interactions.md`,
`packaging.md`), and added `docs/data-model.md` as a living data-shape
reference. All planning work is now done, and `packages/core`
implementation is underway per the "packages/core implementation
roadmap" below: sessions 14 (monorepo scaffolding + ECS foundation), 15
(action/rule pipeline), 16 (turn scheduler + engine loop), and 17 (public
API surface + save/load) are done, each in its own
`docs/session-logs/session-1{4,5,6,7}-2026-07-21.md` entry. Session 18
(map generation: interface & primitives) is also done, see
`docs/session-logs/session-18-2026-07-21.md`. Session 19 (map generation:
built-in algorithms — BSP, cellular automata, minimal WFC, layered biome,
each a region-scoped composable primitive plus a thin whole-zone generator
wrapper, and a new shared `ensureTraversable` prune/connect primitive) is
also done, see `docs/session-logs/session-19-2026-07-21.md`. The world/
region tier was deliberately not scoped into session 19. Session 20 (AI &
behavior: shared FOV and `findPath` primitives, first-party `Wanders`/
`ChasesPlayer`/`Flees`/`Guards` `TakeTurn` rules, `isWalkable`/`isOpaque`
injected at `createApi()`) is also done, see
`docs/session-logs/session-20-2026-07-21.md`. Session 21 (Rendering
foundation: shared glyph-metrics contract, camera deadzone+snap
scrolling/coordinate pipeline, the render-event buffer, FOV/lighting
visualization, layered canvas redraw) is also done, see
`docs/session-logs/session-21-2026-07-21.md`. Session 22 (Palette +
fonts/tileset pipeline: `packages/core/src/palette.js` token/gradient
resolution, `packages/core/src/fontSources.js` multi-font-source
calibration with a pinnable reference, `packages/core/src/tileset.js`'s
symbol definition format, `packages/core/src/glyphRenderer.js`'s material-
tinting draw-time fill resolution, and `packages/core/src/
pixelyphImport.js`'s manifest-to-font-source transform) is also done, see
`docs/session-logs/session-22-2026-07-21.md`. Session 23 (Input adapter +
capture stack: a new `packages/input` package, kept outside `packages/core`
per `docs/design/ui-and-input.md` — `keymap.js`'s device-tagged keybinding
table, `captureStack.js`'s minimal generic push/pop stack (session 24
builds real screen entries on top of it), `inputPipeline.js` wiring the
exclusive-capture-stack decision, `stateNotifier.js`'s coarse
subscribe/notify primitive, `keyboardSource.js`'s event-driven adapter,
`gamepadSource.js`'s poll+edge-detect adapter, and
`keybindingStorage.js`'s settings-slice persistence) is also done, see
`docs/session-logs/session-23-2026-07-22.md`. Session 24 (Custom screens +
audio: `registerScreen`/`PendingUI`/the pause contract expressed entirely
via existing `lock()`/`unlock()`/`resolvePlayerAction`, no new engine
primitive; `registerSound` baked automatically into
`dispatch()`/`dispatchExclusive()`; a Web Audio playback backend
(`packages/core/src/audio.js`) plus a separate optional
`audioLoader.js` decode/cache convenience; mixing-settings persistence
reusing the existing storage backends) is also done, kept bundled rather
than split per the user's explicit choice — see
`docs/session-logs/session-24-2026-07-22.md`. Session 25 (Scripted events +
mod/plugin registration completion, plus `registerEntity`/
`registerEntityType` added per a scope-gap decision made at kickoff) is
also done, see `docs/session-logs/session-25-2026-07-22.md`. This closes
out the `packages/core` implementation roadmap entirely — sessions 14-25
are all complete. The next `/dev-session` scopes `packages/editor`/
`packages/cli` from scratch; no roadmap item is pre-set for it, so that
session's kickoff should discuss scope with the user directly.

## Deferred / future items

- **A real asset-loading strategy for games** — session 24 drew
  `audioLoader.js`'s line at "takes an already-fetched `ArrayBuffer`, never
  fetches itself," matching the existing fonts/tileset-manifest/zone-template
  precedent, but raised while writing it: no session has actually designed
  how a shipped game is expected to fetch/sequence/preload its asset set
  (sounds, fonts, zone templates) end to end — every doc so far just says
  "the caller already has the loaded data." Worth a dedicated look once a
  real game project exists to surface actual requirements (preload screens,
  lazy zone-content loading, asset manifests), rather than guessing ahead of
  a concrete need.

- **Accessible alternative/description layer for the canvas viewport** —
  the canvas game map has no screen-reader-accessible equivalent; flagged
  as a real future addon in `docs/design/ui-and-input.md`'s accessibility
  section, not designed there. Would need its own scoped session.
- **Shipped default colorblind-safe palette** —
  `docs/design/ui-and-input.md` decides palettes must be
  swappable/player-selectable but doesn't ship actual colorblind-safe
  color values (palettes are game-authored content, same as the base
  palette). Providing a default one as a convenience is future work, not
  designed there.
- **Content-pipeline story for large hand-authored world data** —
  `docs/design/build-pipeline.md` decided ordinary code-imported/
  lazy-imported JS/JSON is sufficient for maps/mods/config as designed so
  far, but a game with a very large hand-authored world may eventually
  need a real build step (splitting one big authoring file into many
  lazy-loadable chunks). Not needed by anything decided through session 8;
  would need its own scoped session if a concrete case demands it.
- **Real-time-with-pause battle systems** —
  `docs/design/custom-ui-and-interactions.md` scopes custom battle screens
  to turn-based resolution only; a battle system with its own independent
  real-time clock (rather than the engine's time-units scheduler) is a
  genuinely different primitive, not designed there.
- **Battle-screen-internal AI** — `docs/design/ai-and-behavior.md` covers
  map-level actor decision-making only; a custom battle screen's own
  private opponent logic (per `docs/design/custom-ui-and-interactions.md`'s
  opacity model) remains entirely the screen author's concern, not
  designed in either doc.
- **Zone diff/overlay storage format for mod-defined entity types** —
  `docs/design/mapgen-and-editor.md` expected this to be finalized
  alongside `docs/design/scripting-api.md`'s mod-defined save-slice work;
  checking `scripting-api.md`'s actual save-data section, it never
  specifically addresses zone diffs/overrides carrying mod-defined entity
  types. Genuinely still open, surfaced during the session-13 deep review
  rather than resolved as originally expected.
- **Dev-time tileset/font-calibration editor** —
  `docs/design/fonts-and-tilesets.md` expected this to be UI/UX-session (6)
  territory ("the future tileset editor"); `docs/design/ui-and-input.md`'s
  actual scope (menus, dialogs, keybinding, accessibility, controller
  support) never covered it, and no other session has either. A per-font-
  source calibration override (scale/baseline/centering) currently has no
  authoring UI designed anywhere. Surfaced during the session-13 deep
  review.
- **Background/glyph redraw-cadence decoupling** —
  `packages/core/src/glyphRenderer.js`'s `drawCellBackground`/
  `drawGlyphCell` are kept as separate primitives specifically so a future
  session could redraw cell backgrounds at the terrain layer's
  (infrequent) dirty-check cadence while the entity layer keeps redrawing
  glyphs every animation frame, since backgrounds change far less often
  than the glyph drawn over them. Not built in session 22 —
  `drawTileCell`'s convenience wrapper draws both together every time for
  now; nothing yet exploits the split at the call-site level.
- **Fuller sample-based WFC** — session 19 built a *minimal* WFC generator
  (`packages/core/src/waveFunctionCollapse.js`): author-declared tiles +
  directed per-direction adjacency rules, no pattern learning. A fuller WFC
  (overlapping NxN pattern extraction from an author-supplied sample grid,
  frequency-weighted collapse, real backtracking search) is closer to
  "classic" WFC and was explicitly scoped out as a live decision that
  session — would need its own scoped pass if a concrete game wants
  sample-driven tile content instead of hand-declared adjacency rules.

## Deep-dive planning roadmap

Implementation of `packages/core` doesn't start until this roadmap (or an
explicit user decision to start earlier) says it's ready to. Each session is
research-and-planning only, producing one doc under `docs/design/`. Order is
roughly dependency order (foundational pieces before things that build on
them; packaging last since it depends on everything else) — reorder/split/
merge as needed if a topic turns out bigger or smaller than expected.


1. ~~**Core architecture & game loop**~~ — done, see
   [`docs/design/core-architecture.md`](docs/design/core-architecture.md).
2. ~~**Rendering system**~~ — done, see
   [`docs/design/rendering.md`](docs/design/rendering.md).
3. ~~**Map generation & map editor**~~ — done, see
   [`docs/design/mapgen-and-editor.md`](docs/design/mapgen-and-editor.md).
4. ~~**Scripting & content/plugin API**~~ — done, see
   [`docs/design/scripting-api.md`](docs/design/scripting-api.md).
5. ~~**Font & glyph/tileset pipeline**~~ — done, see
   [`docs/design/fonts-and-tilesets.md`](docs/design/fonts-and-tilesets.md).
6. ~~**UI/UX & input framework**~~ — done, see
   [`docs/design/ui-and-input.md`](docs/design/ui-and-input.md).
7. ~~**Build pipeline & dev/prod split**~~ — done, see
   [`docs/design/build-pipeline.md`](docs/design/build-pipeline.md).
8. ~~**Packaging & distribution**~~ — done, see
   [`docs/design/packaging.md`](docs/design/packaging.md).
9. ~~**Custom UI surfaces & interaction hooks**~~ — done, see
   [`docs/design/custom-ui-and-interactions.md`](docs/design/custom-ui-and-interactions.md).
   Added after the original 8-topic roadmap finished, prompted by a gap
   found reviewing it rather than a pre-planned topic — same
   research-and-planning-only treatment as topics 1-8.
10. ~~**Audio**~~ — done, see [`docs/design/audio.md`](docs/design/audio.md).
    Flagged as a gap while writing topic 9's doc.
11. ~~**AI & behavior**~~ — done, see
    [`docs/design/ai-and-behavior.md`](docs/design/ai-and-behavior.md).
    Flagged as a gap while writing topic 9's doc.

After each session, check off the completed item here, link its doc, and
move the NEXT SESSION pointer to the following one.

## packages/core implementation roadmap

Scoped after the deep-dive planning phase and session-13 review pass
finished. Covers `packages/core` only — `packages/editor` and
`packages/cli` are later, separately-scoped work. Sessions are sized to
fit a ~5-hour token-budget window each, in dependency order (each needs
real, working code from the ones before it, not just a design doc to
read). Each session's own internal checkpoints are worked out live in that
session's own plan step, not fixed here — same treatment the deep-dive
roadmap gave individual sessions' content. Order/grouping may reorder,
split, or merge once a session's own planning step scopes it against real
code, same caveat the deep-dive roadmap carried.

14. ~~**Monorepo scaffolding + ECS foundation.**~~ — done, see
    `packages/core/src/world.js`. Root `package.json` workspaces plus
    `packages/core`'s own `package.json` (raw ESM `src/`,
    `sideEffects: false`, exports-to-source, no build step). The ECS
    bake-off resolved against a library (`bitECS`/miniplex) in favor of a
    ~100-line purpose-built entity/component layer — turn-based scale
    doesn't need a library's real-time-oriented performance headroom, and
    it keeps the save/serialization story exactly matching core's own DTO
    design with no adapter layer. See
    `docs/session-logs/session-14-2026-07-21.md`.
15. ~~**Action/rule pipeline.**~~ — done, see
    `packages/core/src/registry.js` (the generic id/override/
    dependency-ordered registration mechanism every later `register*`
    call reuses) and `packages/core/src/actions.js` (`dispatch`,
    `registerRule`). Dependency validation is deferred to
    `getOrderedIds()` rather than each `register()` call, so registration
    order doesn't have to match dependency order. See
    `docs/session-logs/session-15-2026-07-21.md`.
16. ~~**Turn scheduler + engine loop.**~~ — done, see
    `packages/core/src/scheduler.js` (fixed-per-round energy budget) and
    `packages/core/src/engine.js` (`act`/`lock`/`unlock`/`run`,
    `resolvePlayerAction`). `TakeTurn` conflict resolution added as a
    second, priority-based dispatch mode (`dispatchExclusive` in
    `actions.js`) rather than a `TakeTurn`-specific special case. Real
    `Wanders`/`ChasesPlayer`/`Flees`/`Guards` behavior content is still
    session 20's job (needs `findPath`/FOV first). See
    `docs/session-logs/session-16-2026-07-21.md`.
17. ~~**Public API surface + save/load.**~~ — done, see
    `packages/core/src/api.js` (`createApi()`, the bound public
    inspection/mutation surface every consumer goes through — sessions
    14-16 were free functions taking `world`/`registry`/`scheduler`
    explicitly; this matches `scripting-api.md`'s actual call shape
    instead), `packages/core/src/save.js` (`serialize`/`deserialize`,
    `coreSchemaVersion`/`core` + `gameDataVersion`/`game` + `mods` DTO
    split, sparse stepwise `runMigrations`), `packages/core/src/storage.js`
    (memory/localStorage/atomic-fs backends), and `packages/core/src/
    rng.js` (seeded mulberry32, its `state` serialized alongside world/
    scheduler). `platform`'s no-op-default achievement hook is an injection
    point on `createApi()`, same shape as storage. Headless/deterministic
    testability (seeded RNG, a timer-free `run()` loop, full save/load/
    continue) is proven out end-to-end by `packages/core/test/
    headless.test.js`. See
    `docs/session-logs/session-17-2026-07-21.md`.
18. ~~**Map generation: interface & primitives.**~~ — done, see
    `packages/core/src/mapgen.js` (`registerGenerator`, `generateZone`,
    per-zone deterministic seeding, `GenerationContext` with a
    caller-injected `getNeighborZone` — no core-owned zone storage or
    grid/coordinate system built this session), `packages/core/src/
    zoneComposition.js` (`stampTemplate`, `carveCellularAutomata`,
    `connectCorridor`, the mandatory `runConnectivityPass` over physical +
    `logicalLinks` edges), and `packages/core/src/zoneDiff.js`
    (`applyDiff`/`loadZone`, the seed+diff save strategy). Logical links
    are an edge list on the zone, not entities — a togglable teleporter's
    on/off behavior is an ordinary entity wired to its edge by shared
    `id`, since the connectivity pass is a one-time topological check, not
    a live switch-state simulation. See
    `docs/session-logs/session-18-2026-07-21.md`.
19. ~~**Map generation: built-in algorithms.**~~ — done, see
    `packages/core/src/bsp.js` (`carveBsp`/`bspGenerator`),
    `packages/core/src/cellularAutomataGenerator.js`,
    `packages/core/src/waveFunctionCollapse.js`
    (`collapseWfc`/`wfcGenerator`, minimal single-cell tiles + directed
    adjacency rules — a fuller sample-based WFC is a new `BACKLOG.md`
    deferred item), and `packages/core/src/layeredBiome.js`
    (`partitionBiomes`/`layeredBiomeGenerator`, nearest-seed-point
    partition). Each algorithm is a region-scoped composable primitive with
    a thin whole-zone generator wrapper, so an author can compose more than
    one algorithm into a single zone (e.g. BSP rooms opening into a CA
    cave) — raised by the user reviewing the session's plan, which
    reshaped BSP/WFC/layered-biome from monolithic whole-zone generators
    into that split. Also added `ensureTraversable` (prune or connect
    disconnected walkable regions the mandatory connectivity pass doesn't
    cover), another live plan revision from the user, used by three of the
    four generators. The optional world/region tier was deliberately not
    scoped in. See `docs/session-logs/session-19-2026-07-21.md`.
20. ~~**AI & behavior.**~~ — done, see `packages/core/src/fov.js`
    (`computeFov`/`fovContains`, recursive shadowcasting), `packages/core/
    src/pathfinding.js` (`findPath`, A* over 4-directional adjacency), and
    `packages/core/src/behaviors.js` (`wandersRule`, `chasesPlayerRule`,
    `fleesRule`, `guardsRule` plus their default-priority constants).
    `isWalkable`/`isOpaque` are injected once at `createApi()`, the same
    DI shape as `platform`/`storage`/`rng` — resolved live with the user
    as this session's one real architectural fork, since core still owns
    no grid/zone storage (session 18) but a first-party `TakeTurn` rule
    needs to reach the game's map query without being rewritten per game.
    `Position {x, y}` is now a real (no longer illustrative-only) core
    convention, first needed by this session. See
    `docs/session-logs/session-20-2026-07-21.md`.
21. ~~**Rendering foundation.**~~ — done, see `packages/core/src/
    glyphMetrics.js`/`glyphRenderer.js` (shared glyph-metrics contract,
    canvas `fillText` viewport - `color` an opaque token, resolved by
    session 22), `camera.js` (deadzone+snap scrolling, coordinate pipeline,
    map-bounds clamping - camera state lives in the rendering layer, not
    core save state), `renderEvents.js` (a single sequential FIFO with a
    delay/duration-driven sequencer - confirmed necessary by the deep
    review, one shared ordered-event mechanism for both rendering and
    later audio rather than independent per-consumer cursors), `visibility.js`
    (pure FOV/lighting visualization over session 20's `computeFov`) plus
    `memory.js` (optional first-party `Memory` component convenience
    wiring, swappable/ignorable per the user's explicit ask), `animation.js`
    (advance-by-dt tween/effect bookkeeping, pure over an explicit `now`),
    and `renderLayers.js` (layered redraw - a caller-supplied
    `{originX,originY,mapVersion}` version token keeps the terrain layer's
    dirty check near-zero cost). Canvas-touching code tested against a fake
    recording `ctx`, not `node-canvas`/jsdom. See
    `docs/session-logs/session-21-2026-07-21.md`.
22. ~~**Palette + fonts/tileset pipeline.**~~ — done, see
    `packages/core/src/palette.js` (`createPalette`/`resolveColor`, a
    `{ token }` wrapper resolving one level against a palette's token map,
    a gradient descriptor's own stops nesting one `{ token }` each),
    `packages/core/src/fontSources.js` (`createFontSourceRegistry`/
    `registerFontSource`/`deriveCalibration` — default calibration is
    metrics-based (`unitsPerEm`/`ascender`/`descender`), not
    raster-measurement-based, since the latter would need a live
    font/ctx and break the "pure, unit-testable" discipline every other
    `core` module holds; the calibration reference is pinnable at
    registry-creation time via `{ reference }`, independent of
    registration order — resolved live with the user as this session's
    one real architectural fork, prompted by wanting a Pixelyph icon font
    to be the effective standard regardless of when a monospace fallback
    gets registered), `packages/core/src/tileset.js` (`registerSymbol`/
    `resolveSymbol`, `codepoint` standardized as a uniform lowercase hex
    string across every font source), `packages/core/src/glyphRenderer.js`
    (material tinting: `drawCellBackground`/`drawTileCell`, a resolved
    gradient becoming a real `ctx.createLinearGradient`), and
    `packages/core/src/pixelyphImport.js` (`glyphManifestToFontSource`,
    a pure transform, no file I/O). DOM/SVG gradient fallback stays
    deferred alongside every other DOM-path item this rendering arc has
    deferred — no DOM rendering path exists in this monorepo yet. See
    `docs/session-logs/session-22-2026-07-21.md`.
23. ~~**Input adapter + capture stack.**~~ — done, see `packages/input/src/
    keymap.js`, `captureStack.js`, `inputPipeline.js`, `stateNotifier.js`,
    `keyboardSource.js`, `gamepadSource.js`, and `keybindingStorage.js`. A
    new package, kept outside `packages/core` per `ui-and-input.md`'s
    decision that core stays a pure state/rules engine with no DOM
    dependency — `packages/input` stays dependency-free in the other
    direction too, no import of `@glyphrogue/core`. The capture stack this
    session built is deliberately minimal (a generic push/pop stack of
    opaque ids, gating input actions only) — the real screen/dialog/menu
    stack with lifecycle and focus management is session 24's job, built
    on top of this same stack, resolved live with the user as this
    session's one real architectural fork alongside the package-naming
    decision above. See `docs/session-logs/session-23-2026-07-22.md`.
24. ~~**Custom screens + audio.**~~ — done, see `packages/core/src/
    screen.js` (`registerScreen`/`getScreen`) plus `api.openScreen`/
    `api.closeScreen`, which express the pause contract entirely via the
    existing `lock()`/`unlock()`/`resolvePlayerAction` — no new engine
    primitive needed. `packages/core/src/sound.js` (`registerSound`/
    `soundsFor`) is baked directly into `dispatch()`/`dispatchExclusive()`
    (`actions.js`), automatically enqueuing a render event for every
    resolved action matching a registered sound's `trigger`/`match`, per
    `audio.md`'s "core's rule-resolution machinery pushes entries onto this
    buffer regardless of consumer." `packages/core/src/audio.js`
    (`playSound`/`playMusic`) is the sole module touching real
    `AudioContext`/`AudioBufferSourceNode`/`GainNode` calls, mirroring
    `glyphRenderer.js`'s posture — takes an already-decoded `AudioBuffer`,
    no swappable backend. `packages/core/src/audioLoader.js`
    (`createAudioLoader`/`loadBuffer`/`getBuffer`) is a separate, optional
    `decodeAudioData`+cache convenience — resolved live with the user
    across several rounds as this session's one real architectural fork
    (see the session log for the full discussion), landing on "core takes
    a decoded buffer for playback, but ships a tested decode/cache
    primitive alongside it rather than leaving every game to reinvent
    that"; it takes an already-fetched `ArrayBuffer`, never performs
    `fetch` itself. `packages/core/src/audioSettings.js`
    (`saveMixSettings`/`loadMixSettings`) persists mixing volume as its own
    settings slice, reusing the existing storage backends the same way
    `packages/input`'s `keybindingStorage.js` already does. Kept bundled
    rather than split, per the user's explicit choice. See
    `docs/session-logs/session-24-2026-07-22.md`.
25. ~~**Scripted events + mod/plugin registration completion.**~~ — done,
    see `packages/core/src/scriptedEvents.js` (`registerScriptedEvent`/
    `waitFor`, both action-match and `timeUnits` forms; `EventState`
    progress tracks on a dedicated tracking entity created lazily on first
    trigger match, tagged via a `ScriptedEvent` marker so it lives in
    normal ECS state and saves/loads for free), `packages/core/src/
    engine.js` (a `Timer` component-tag branch in `act()`, parallel to the
    existing `PlayerControlled` check — a timed wait is an ordinary
    scheduler actor with a negative initial budget, no new engine
    primitive), `packages/core/src/mods.js` (mod module format +
    dependency-ordered loading, reusing `registry.js`'s generic
    topological sort for mod ids; hand-rolled `^`/`~`/exact semver range
    checking to stay at zero runtime dependencies), and `packages/core/src/
    recordingApi.js` (the manifest-derivation mechanism, mirroring only the
    `register*` surface into a flat call-order list). Also closed a scope
    gap per user decision at kickoff: `registerEntity`/`registerEntityType`
    (`packages/core/src/definitions.js`) were listed in `scripting-api.md`
    but missing from this session's original BACKLOG description despite
    it being called the session that "ties together the full registration
    surface" — added here instead of left as a new deferred item. See
    `docs/session-logs/session-25-2026-07-22.md`.

All planning-roadmap topics (1-11) and all `packages/core`
implementation-roadmap sessions (14-25) are now complete. The next
`/dev-session` scopes `packages/editor`/`packages/cli` from scratch — no
roadmap pointer exists for that yet, so that session's kickoff step should
discuss scope with the user rather than assume a pre-set item.

After each session, check off the completed item here and move the NEXT
SESSION pointer to the following one, same convention as the deep-dive
roadmap above.
