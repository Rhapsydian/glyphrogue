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
reference. All planning work is now done — the next `/dev-session` starts
**session 14, the first `packages/core` implementation session**, per the
"packages/core implementation roadmap" below. This was an explicit user
decision, not an automatic default.

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

14. **Monorepo scaffolding + ECS foundation.** Root `package.json`
    (`workspaces: ["packages/*"]`), `packages/core`'s own `package.json`
    (raw ESM `src/`, `sideEffects: false`, `exports` pointing at source, no
    build step — `build-pipeline.md`), `node --test` harness. ECS library
    bake-off (`bitECS` vs. alternatives, `core-architecture.md`), basic
    entity/component create/query/destroy. Nothing else can start until
    this exists.
15. **Action/rule pipeline.** Action dispatch, `registerRule`, ordered
    per-action-type pipeline evaluation, follow-on chaining, veto
    semantics (`core-architecture.md`). The conflict/override mechanism
    shared by every later `register*` call (hard error on unconfirmed
    duplicate `id`, self-confirming `options.override`, dependency-graph
    load ordering — `scripting-api.md`) gets built generically here.
16. **Turn scheduler + engine loop.** Time-units `Scheduler`/`Engine`
    (rot.js-style), `lock()`/`unlock()`, `act()` contract. `TakeTurn`
    dispatch for non-player actors, with the constant-or-function
    `priority` conflict resolution the deep review settled
    (`ai-and-behavior.md`). Confirms `lock()` only ever gates real async
    suspension, never animation pacing.
17. **Public API surface + save/load.** The one public inspection/
    mutation API every consumer goes through, formalized from what
    sessions 14-16 built ad hoc. Save DTOs (`coreSchemaVersion`/`core`,
    `gameDataVersion`/`game`, per-mod slices), stepwise migrations,
    storage backend abstraction (localStorage + Electron-filesystem with
    atomic writes). The thin `platform` capability (no-op-by-default
    achievement hook) fits here too — same injection shape as storage.
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
