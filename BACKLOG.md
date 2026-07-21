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
`docs/session-logs/session-1{4,5,6,7}-2026-07-21.md` entry. The next
`/dev-session` starts **session 18, map generation: interface &
primitives**.

## Deferred / future items

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
18. **Map generation: interface & primitives.** `GenerationContext`,
    `registerGenerator`, composition primitives (stamp template, carve CA,
    connect corridor, connectivity pass with physical + logical-link
    edges), `ZoneDTO` shape, seed+diff save strategy
    (`mapgen-and-editor.md`).
19. **Map generation: built-in algorithms.** BSP, cellular automata, WFC,
    and layered biome generation registered through session 18's
    interface, plus the optional world/region tier if scoped in. Split
    from session 18 since four real algorithms is enough on its own.
20. **AI & behavior.** Shared shadowcasting/visibility primitive (FOV —
    also feeds rendering next session and light propagation), shared
    `findPath` primitive, first-party `TakeTurn` rules (`Wanders`,
    `ChasesPlayer`, `Flees`, `Guards`) with default priorities
    (`ai-and-behavior.md`, `rendering.md`).
21. **Rendering foundation.** Shared glyph-metrics contract, canvas
    `fillText` viewport, camera (deadzone+snap scrolling, coordinate
    pipeline, map-bounds clamping), layered canvas redraw (static terrain
    vs. entity/effects), the render-event buffer confirmed necessary by
    the deep review, FOV/lighting visualization using session 20's
    primitive (`rendering.md`).
22. **Palette + fonts/tileset pipeline.** Palette/theme object (token
    vocabulary + raw-color escape hatch), font-source registration +
    calibration records, the tileset definition format
    (`symbol -> {fontFace, codepoint, paletteToken(s)}`), material tinting
    (draw-time fill, SVG fallback for DOM gradients), Pixelyph
    glyph-manifest import path (`fonts-and-tilesets.md`).
23. **Input adapter + capture stack.** Physical input → input-action
    mapping (keyboard event-driven, gamepad poll+edge-detect), the
    exclusive capture stack, DOM state binding (coarse subscribe/notify),
    keybinding/remapping + settings-slice persistence
    (`ui-and-input.md`).
24. **Custom screens + audio.** `PendingUI`, `registerScreen`, the screen
    lifecycle/pause contract, canvas-in-screen support, screen nesting,
    mid-screen save/reload behavior (`custom-ui-and-interactions.md`); Web
    Audio backend, `registerSound` reading off the render-event buffer,
    screen-direct playback, mixing settings (`audio.md`). Bundled since
    both are comparatively small, additive layers on sessions 21/23's
    stack and buffer — split into two sessions if it proves too big once
    actually scoped.
25. **Scripted events + mod/plugin registration completion.**
    `registerScriptedEvent`/`waitFor` (action-match and `timeUnits`
    forms), `EventState`, synthetic `EventTimerElapsed`. Mod module format
    (descriptor + `register(api)`), the recording-api manifest mechanism,
    versioning/compatibility (core API version vs. save schema version)
    (`scripting-api.md`). Last since it ties together the full
    registration surface everything else already built.

After each session, check off the completed item here and move the NEXT
SESSION pointer to the following one, same convention as the deep-dive
roadmap above.
