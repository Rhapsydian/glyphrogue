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

An npm-workspaces monorepo, following the pattern already validated in
`pixelloom` → `pixelyph` (a small, dependency-light core library wrapped by a
larger app with UI/tooling):

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

- **`packages/core`** — rendering, ECS/game loop, input, audio, save/load,
  **procedural map generation** (runs at runtime — ships in every game, not
  a dev-only tool), and the scripting/plugin API surface. Modeled on
  `pixelloom`'s discipline: `sideEffects: false`, minimal dependencies,
  published via subpath exports (`glyphrogue/runtime`, or similar) so a
  game's production build only ever pulls this in.
- **`packages/editor`** — the dev-time **map editor** (hand-author maps,
  tune/preview procedural-generator parameters and seeds, stamp/override
  generated content), plus tileset editor, scripting console, and config UI,
  with a hot-reload dev harness. Depends on `core` for live preview — the
  editor is a design-time surface over the same procgen API a shipped game
  calls at runtime, not a separate map format. Structurally excluded from
  production builds by never being imported from the game's build entry
  point — not just tree-shaken out.
- A **game project** (separate repo, same relationship pixelyph has to
  pixelloom) depends on `glyphrogue` core for its production entry and on
  the editor package only in its dev Vite config — mirroring the
  `build:itch` custom-mode pattern already used in `pixelyph/package.json`.

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
effects) keeps this viable at scale. Camera uses deadzone+snap scrolling;
color is a curated token palette with a raw-color escape hatch; FOV and
lighting share one shadowcasting primitive in `core`, reused by rendering,
AI perception, and light propagation alike. Full depth in
[`docs/design/rendering.md`](docs/design/rendering.md).

## Scripting & modding

Plain TypeScript/JS modules against a defined plugin API (entities,
components, systems, map generators, item/creature definitions). No
sandboxing in v1 — mods run with full JS access. Full depth in
`docs/design/scripting-api.md` (planned).

## Fonts & glyphs — Pixelyph tie-in

Pixelyph's Glyph mode already exports woff fonts, SVG glyphs, and icon-font
CSS (`pixelyph/src/export/font/*`). Glyphrogue's font/tileset pipeline should
treat Pixelyph glyph-set exports as a first-class asset source, so a game's
custom glyph tileset can be authored directly in Pixelyph and dropped in.
Full depth in `docs/design/fonts-and-tilesets.md` (planned).

## Build targets

- **Static HTML / GitHub Pages / itch.io** — same Vite production build;
  reuse the custom-mode pattern (`build:itch`) already proven in `pixelyph`.
- **Electron desktop / Steam** — `electron-vite` + `electron-builder`, same
  toolchain as `pixelyph`, plus `steamworks.js` for achievements/cloud
  saves when targeting Steam specifically.

**Why Electron over Tauri**: `steamworks.js` and the other common Steamworks
wrapper libraries only officially support Electron/NW.js; Tauri devs report
real friction getting Steamworks working (one reported falling back to
Electron entirely for Steam Linux after a weekend fighting the Sniper SDK in
Tauri). Tauri wins on bundle size/memory, but that's not the deciding factor
here — and it matches tooling already working in `pixelyph`.
Sources: [Publishing Web Games on Steam with Electron (Phaser)](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron), [steamworks.js](https://github.com/ceifa/steamworks.js/), [HN: Tauri Steam Linux friction](https://news.ycombinator.com/item?id=46087456)

Full depth in `docs/design/packaging.md` (planned).

## Dev/prod code splitting

Tree-shaking alone is unreliable for stripping dev-only tooling that has
side effects (registering debug menus, etc.). The robust pattern is
**structural separation via package subpath exports** (e.g.
`glyphrogue/runtime` vs `glyphrogue/editor`) so production game code never
even imports the editor package, rather than relying on a bundler to notice
it's unused. Full depth in `docs/design/build-pipeline.md` (planned).

## Testing

`node --test`, no framework — same low-ceremony convention as
`pixelloom`/`pixelyph`.
