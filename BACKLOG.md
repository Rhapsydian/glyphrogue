# Glyphrogue backlog

## NEXT SESSION

Deep-dive planning session 1: **Core architecture & game loop**. Start
`/dev-session` and go straight into this topic — scope is below, output is
`docs/design/core-architecture.md`. Don't ask what to work on; this is the
next item in the deep-dive roadmap.

## Deep-dive planning roadmap

Implementation of `packages/core` doesn't start until this roadmap (or an
explicit user decision to start earlier) says it's ready to. Each session is
research-and-planning only, producing one doc under `docs/design/`. Order is
roughly dependency order (foundational pieces before things that build on
them; packaging last since it depends on everything else) — reorder/split/
merge as needed if a topic turns out bigger or smaller than expected.

1. **Core architecture & game loop** — `docs/design/core-architecture.md`
   *(NEXT)*. ECS vs. alternative data model, turn-based tick/scheduling,
   save/load & serialization strategy, the state boundary between `core`
   and `editor`.
2. **Rendering system** — `docs/design/rendering.md`. Hybrid Canvas 2D + DOM
   glyph rendering in depth: shared glyph-metrics source, camera/viewport
   and scrolling, color/palette system, FOV/lighting visualization,
   animation, performance budget for large maps.
3. **Map generation & map editor** — `docs/design/mapgen-and-editor.md`.
   Runtime procedural generation algorithms (e.g. BSP, cellular automata,
   wave-function-collapse, layered biome generation in the Caves-of-Qud
   vein), the generation API exposed to scripts/mods, the dev-time map
   editor (hand-authoring, tuning/previewing generator seeds and params),
   and how hand-authored content composes with procedural (templates,
   stamps, overrides).
4. **Scripting & content/plugin API** — `docs/design/scripting-api.md`.
   TS/JS mod module format, data-driven entity/item/creature definitions,
   event/hook system, how mods register systems or map generators,
   versioning/compatibility story for mods.
5. **Font & glyph/tileset pipeline** — `docs/design/fonts-and-tilesets.md`.
   Monospace/pixel font handling, the Pixelyph glyph-set import path,
   tileset definition format, palette/color-mapping (e.g. material tinting
   of a shared glyph).
6. **UI/UX & input framework** — `docs/design/ui-and-input.md`. Menus,
   dialogs, inventory/equipment screens, keybinding & remapping,
   accessibility/controller support, how DOM UI reads/writes core state.
7. **Build pipeline & dev/prod split** — `docs/design/build-pipeline.md`.
   Monorepo tooling specifics, Vite config for the core/editor subpath-export
   split, asset pipeline (fonts, maps, data files) for dev vs. prod, and how
   a downstream game project is structured/scaffolded
   (`create-glyphrogue-game`).
8. **Packaging & distribution** — `docs/design/packaging.md`. Static
   HTML/GitHub Pages/itch.io build specifics, Electron + `steamworks.js`
   integration (achievements, cloud saves), update/code-signing strategy,
   Steam build/page requirements.

After each session, check off the completed item here, link its doc, and
move the NEXT SESSION pointer to the following one.
