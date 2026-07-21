# Glyphrogue — design

Living top-level summary of architecture decisions. Deep-dive docs in
`docs/design/` (see `BACKLOG.md` for the roadmap) will refine and expand each
section below as they're written — treat those as the source of truth once
they exist, and this doc as the index/summary.

## Goal

A web-based game engine for ASCII/glyph-driven roguelikes, in the spirit of
*Caves of Qud*: monospace/pixel-font glyph rendering, a full dev-time
toolchain (map editor, tileset/config tools, scripting) that does **not**
ship in production, and support for four build targets: static HTML, GitHub
Pages, itch.io, and a Steam-compatible Electron desktop build.

## Naming

**Glyphrogue** (Glyph + roguelike) — chosen after ruling out Glyphscii (reads
awkwardly, "scii" swallows the A from ASCII) and a round of terminal/console-
themed alternatives (Glyphterm, Glyphshell, Glyphansi, Glyphcursor).

## Repo structure

An npm-workspaces monorepo. `pixelloom` → `pixelyph` validates the
*architectural* split this follows (a small, dependency-light core library
wrapped by a larger app with UI/tooling) — not the workspaces mechanism
itself, since that pair is actually two separately-published repos with an
ordinary npm dependency between them, no `workspaces` field involved. Real
workspaces are a Glyphrogue-specific choice, for lockstep pre-1.0
development across `core`/`editor`/`cli`:

```
glyphrogue/
  packages/
    core/     — the runtime engine (ships in every production game)
    editor/   — dev-time tools, depends on core, never imported by games
    cli/      — create-glyphrogue-game scaffolding tool (later)
  docs/design/  — in-depth design docs, one per deep-dive planning session
  README.md
  DESIGN.md
  BACKLOG.md
```

- **`packages/core`** (`@glyphrogue/core`) — rendering, ECS/game loop,
  input, audio, save/load, **procedural map generation** (runs at
  runtime — ships in every game, not a dev-only tool), and the
  scripting/plugin API surface. Modeled on `pixelloom`'s discipline:
  `sideEffects: false`, minimal dependencies, raw ESM `src/` with no build
  step of its own — same as `pixelloom` ships itself.
- **`packages/editor`** (`@glyphrogue/editor`) — the dev-time **map
  editor** (hand-author maps, tune/preview procedural-generator parameters
  and seeds, stamp/override generated content), plus tileset editor,
  scripting console, and config UI, with a hot-reload dev harness. Depends
  on `core` for live preview — the editor is a design-time surface over the
  same procgen API a shipped game calls at runtime, not a separate map
  format. Structurally excluded from production builds by being a
  **separate package** a game's production entry point never imports — not
  a subpath of `core`, and not just tree-shaken out.
- A **game project** (separate repo, same relationship `pixelyph` has to
  `pixelloom`) depends on the published `@glyphrogue/core` for its
  production entry and adds `@glyphrogue/editor` as a dev dependency,
  imported only from a separate dev-only HTML entry point — mirroring the
  `build:itch` custom-mode pattern already used in `pixelyph/package.json`.
  Full depth in
  [`docs/design/build-pipeline.md`](docs/design/build-pipeline.md).

## Core architecture & game loop

Entities/components (ECS-style data, candidate library `bitECS`) with game
logic as **actions + rules** rather than per-frame systems, since plain ECS
systems don't sequence well for turn-based play. Turn order runs on a
**time-units** scheduler (variable action costs, not fixed ticks), driven
by an async engine loop (rot.js-style `lock`/`unlock`) so a turn can
suspend on player input. Saves are DTO-based with independently-versioned
`coreSchemaVersion`/`gameDataVersion` slices and stepwise migrations.
`core` exposes one public inspection/mutation API that the game runtime,
`editor`, first-party content, and (later) end-user mods all consume — no
backdoor access to internals. Full depth in
[`docs/design/core-architecture.md`](docs/design/core-architecture.md).

## Rendering

Hybrid, per explicit design goal: Canvas 2D for the game viewport
(map/entity glyph grid — same approach as [rot.js](https://ondras.github.io/rot.js/)),
DOM/CSS grid for menus, HUD, dialogs, inventory. Canvas draws glyphs via
`ctx.fillText` against the same webfont DOM UI uses (Pixelyph's exported
font), so both paths share one glyph-metrics source by construction. A
layered-canvas redraw strategy (static terrain vs. animated entities/
effects) keeps this viable at scale. `lock`/`unlock` gates only real async
suspension (player input, an open custom screen) and never animation
pacing, confirming a shared, ordered render-event buffer as a requirement
(not an optional design) for sequencing visual effects across a busy
multi-actor round — the same buffer `audio.md` reuses for sound
sequencing. Camera uses deadzone+snap scrolling;
color is a curated token palette with a raw-color escape hatch; FOV and
lighting share one shadowcasting primitive in `core`, reused by rendering,
AI perception, and light propagation alike. Full depth in
[`docs/design/rendering.md`](docs/design/rendering.md).

## Map generation & map editor

Procedural generation is an optional **two-tier** structure: a coarse
world/region generator producing per-tile biome/adjacency metadata, with
each tile lazily generating a detailed local zone on first entry — a game
can skip the world tier and generate (or hand-author) a single zone
directly. All algorithms (BSP, cellular automata, wave-function-collapse,
layered biome generation) sit behind one pluggable generator interface
(`registerGenerator`) rather than being separately architected, and can
compose in sequence within a single zone. Determinism is a hard
requirement, not just tidy: zones save as seed/params plus a player-
mutation diff rather than a full grid, and players can share seeds to
reproduce the same generated world. A mandatory connectivity pass
(graph-based reachability, covering both physical adjacency and logical
links like teleporters) guarantees stamped content is reachable unless
explicitly marked otherwise. The dev-time map editor reuses `core`'s
existing static edit mode and the same generator API for live
seed/param tuning and previewing — hand-edited and generated zones share
one `ZoneDTO` format. Full depth in
[`docs/design/mapgen-and-editor.md`](docs/design/mapgen-and-editor.md).

## Scripting & modding

A mod (first-party or, later, end-user) is a single default-exported
descriptor (`id`, `version`, `dependencies`, `register(api)`) — one entry
point regardless of how the module was loaded. Definitions
(entities/items/creatures) are inert component data; behavior is a **rule**
keyed to an action type, run as part of an ordered pipeline per action type
so mods can layer in reactions without overriding core's own rules.
Scripted events reuse the same action/rule model, with a step-list format
as sugar for multi-step sequences only. All `register*` calls share one
`id`-first, dependency-graph-ordered registration mechanism with explicit,
self-confirming overrides (`options.override` must restate the id) and hard
errors on unresolved conflicts. First-party content shares one game-owned
save slice; end-user mods each get an independently-versioned slice, and a
save requires its full mod set to load. `core` has two independent version
numbers (save schema vs. plugin API) that mods declare semver-range
compatibility against. **v1 ships no sandboxing** for mods of either kind —
documented as a real, platform-dependent risk (much lower on web than
Electron) — with authors able to disable modding **structurally**, per
platform or globally, reusing the existing dev/prod build-split mechanism
rather than a runtime flag. Full depth in
[`docs/design/scripting-api.md`](docs/design/scripting-api.md).

## Fonts & glyphs — tileset pipeline

A tileset maps a game symbol to `{ fontFace, codepoint, paletteToken(s) }`,
mixing font sources per-symbol (a web-safe monospace base plus imported
glyphs) rather than requiring one merged font — each registered font source
carries a stored, override-able calibration record into one shared cell
grid, generalizing rendering.md's shared-metrics decision. Pixelyph stays an
asset-only source (Glyphrogue never imports its code): a specified set of
manifest/export enhancements — a font-level meta block, per-glyph metrics,
codepoint-keyed stability, manifest generation independent of the icon-font
CSS export — lets its exports serve as a first-class glyph source without
that coupling. Material tinting (recoloring a shared glyph per-material)
resolves as a draw-time fill choice (canvas `fillStyle`/gradient, DOM plain
CSS falling back to SVG only for gradients) rather than needing a second,
bitmap-blit rendering backend. Full depth in
[`docs/design/fonts-and-tilesets.md`](docs/design/fonts-and-tilesets.md).

## UI/UX & input

An input adapter outside `core` maps physical input (keyboard, gamepad) to
device-agnostic **input actions**, distinct from core's own rule-pipeline
Actions. An exclusive capture stack — the topmost active screen/dialog/menu
claims all input actions, falling through to core's Action dispatcher (and
`unlock()`) only when nothing captures — resolves how menus suspend
gameplay. The screen/dialog/menu stack itself is UI-owned; core stays
unaware of it, exposing core-triggered UI (e.g. a scripted event's
`ShowDialogue` step) as plain state the UI layer subscribes to rather than
calling into it directly. DOM UI reads that state via a framework-agnostic,
coarse-grained subscribe/notify primitive (one signal per resolved core
Action, not per-frame or per-fine-grained-query) and writes back only
through the existing inspection/mutation API. Keybindings are
game-defined, array-per-input-action (supporting multiple bindings at
once), and persist as a settings slice independent of save data. Gamepad
input feeds the same input-action pipeline as keyboard, polled and
edge-detected rather than event-driven, with analog input collapsing to
discrete directional actions past a deadzone; local co-op is out of scope.
Accessibility: focus management rides the capture stack, colorblind
support is a swappable-palette mechanism (no shipped default palette yet),
and the canvas viewport is an explicit non-goal for screen readers. Full
depth in [`docs/design/ui-and-input.md`](docs/design/ui-and-input.md).

## Custom UI surfaces & interaction hooks

A game or mod registers a wholly custom interactive screen — a skill-check/
dice-roll modal, a talent tree, a full turn-based battle system — through
one generic `registerScreen(id, {...})` call, generalizing `ShowDialogue`'s
one-off `PendingDialogue` marker into a single `PendingUI({ screenId,
payload })` component the UI layer always watches for, the same "one
interface, many implementations" shape as `registerGenerator`. Opening a
screen holds the current actor's existing `lock()` open for the screen's
whole lifetime rather than needing a new pause primitive — the engine's
strictly sequential scheduler already suspends everything else for free.
The screen itself is opaque to core (private internal logic, no rule fires
for anything happening inside it) and closes by dispatching exactly one
ordinary core Action carrying its result, which the normal rule pipeline
sees like any other action. Purely cosmetic animation delay reuses
rendering.md's model/view decoupling; anything needing player input
mid-animation (e.g. spending a resource to reroll) is a short
`registerScriptedEvent`/`waitFor` sequence — this closes the lock/unlock-
vs-animation question only for screen-triggered animation, not the
separate question (now resolved in `rendering.md`) of ordinary per-actor
movement/attack tweening during an ordinary turn. A `registerScreen` surface
holding `lock()` open also settles what happens if a save (specifically
autosave) fires while it's open: the marker reopens the screen fresh from
its original payload on load, an accepted v1 gap rather than a designed
mid-screen serialization protocol. `Attack`/`Damage`/`Death` is
confirmed a first-party default rule set, not an exclusive core mechanism,
so a custom battle system can define its own action vocabulary entirely;
battle screens use the same registerScreen/pause contract as a dice roll,
turn-based only — real-time-with-pause battle systems are explicitly out of
scope. Full depth in
[`docs/design/custom-ui-and-interactions.md`](docs/design/custom-ui-and-interactions.md).

## Audio

Audio is reactive by default, not core-triggered: `registerSound(id, {
trigger: actionType, source, match? })` maps action types (optionally
filtered by a component predicate) to sound assets. An audio subscriber
reads off the same shared, ordered render-event buffer rendering uses to
sequence visual effects (not the coarser per-top-level-action notification
DOM UI uses, which batches an entire follow-on chain into one event) — one
entry per resolved action, in order, so multi-step chains like `Attack →
Damage → Death` sequence correctly. No new core-state concept, unlike
`ShowDialogue`'s `PendingDialogue`. A `registerScreen` surface (custom UI
doc, above) is the
one exception, calling playback directly for its own private internal
moments. No swappable/dependency-injected backend: Web Audio API is
identical across all four declared build targets (Electron included, since
it's Chromium), so there's no second platform to abstract for — one
concrete implementation, unlike the input adapter or `platform` capability.
Volume/mixing persists as a settings slice outside save data, reusing the
keybinding-persistence mechanism. Full depth in
[`docs/design/audio.md`](docs/design/audio.md).

## AI & behavior

No new registration mechanism: a non-player actor's turn dispatches a
core-shipped `TakeTurn` action, and ordinary rules react to it matched
by component (`Wanders`, `ChasesPlayer`, `Flees`, `Guards`), the same
component-tag pattern as `ExplodesOnDeath`. Core ships a handful of these as
first-party default rules — same relationship core has to its four
built-in map generators, not a closed set. Since these can conflict
(an actor can't both `Flee` and `Guard` the same turn), each rule declares
an `options.priority` (constant or computed fresh from current state) and
the highest resolved value wins — a deliberate divergence from the rule
pipeline's usual additive layering, not an application of it. `core` also
exposes a shared
`ctx.findPath(from, to, opts)` pathfinding primitive AI rules call into,
mirroring `rendering.md`'s shared shadowcasting primitive (which already
covers AI perception). Scoped to map-level, core-visible actors only — a
custom battle screen's own private opponent logic (per the custom UI doc's
opacity model) is the screen author's concern, not this mechanism's. Full
depth in
[`docs/design/ai-and-behavior.md`](docs/design/ai-and-behavior.md).

## Build targets

- **Static HTML / GitHub Pages / itch.io** — same Vite production build;
  reuse the custom-mode pattern (`build:itch`) already proven in `pixelyph`.
  A scaffolded game gets an automated GitHub Pages deploy workflow; itch.io
  deploy (`butler push`) stays a documented manual step, since it needs a
  per-project API key/channel a template can't fill in.
- **Electron desktop / Steam** — `electron-vite` + `electron-builder`, same
  toolchain as `pixelyph`. `core` exposes a thin, no-op-by-default
  `platform` capability (dependency-injected, same shape as its rendering/
  input adapters) that a game's own rules call to unlock achievements;
  the Electron scaffold wires it to `steamworks.js` through a small
  main/preload IPC bridge. Cloud saves use Steam's automatic folder-based
  Cloud against the existing filesystem save backend — no API calls needed.
  Ships signing-ready (env-var-driven `electron-builder` config) but
  unsigned by default, since certificates are inherently per-author;
  no `electron-updater` in v1 (Steam and the itch app both self-update
  already; direct-download is a documented gap).

**Why Electron over Tauri**: `steamworks.js` and the other common Steamworks
wrapper libraries only officially support Electron/NW.js; Tauri devs report
real friction getting Steamworks working (one reported falling back to
Electron entirely for Steam Linux after a weekend fighting the Sniper SDK in
Tauri). Tauri wins on bundle size/memory, but that's not the deciding factor
here — and it matches tooling already working in `pixelyph`.
Sources: [Publishing Web Games on Steam with Electron (Phaser)](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron), [steamworks.js](https://github.com/ceifa/steamworks.js/), [HN: Tauri Steam Linux friction](https://news.ycombinator.com/item?id=46087456)

Full depth in
[`docs/design/packaging.md`](docs/design/packaging.md).

## Dev/prod code splitting

Tree-shaking alone is unreliable for stripping dev-only tooling that has
side effects (registering debug menus, etc.). The robust pattern is
**structural separation via two separate packages** (`@glyphrogue/core` vs.
`@glyphrogue/editor`, not one package's subpath exports) reached through
**separate build entry points** — a game's `index.html` (prod) never
imports `@glyphrogue/editor`; only a separate `dev.html` does — so
production game code has no reachable path to the editor package at all,
rather than relying on a bundler to notice it's unused. Full depth in
[`docs/design/build-pipeline.md`](docs/design/build-pipeline.md).

## Testing

`node --test`, no framework — same low-ceremony convention as
`pixelloom`/`pixelyph`.
