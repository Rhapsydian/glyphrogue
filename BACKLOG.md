# Glyphrogue backlog

## NEXT SESSION

Deep-dive planning session 6: **UI/UX & input framework**. Start
`/dev-session` and go straight into this topic — scope is below, output is
`docs/design/ui-and-input.md`. Don't ask what to work on; this is the next
item in the deep-dive roadmap.

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
6. **UI/UX & input framework** — `docs/design/ui-and-input.md` *(NEXT)*. Menus,
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
