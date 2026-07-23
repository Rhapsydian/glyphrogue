# Glyphrogue

A web-based game engine for ASCII/glyph-driven roguelikes, in the spirit of
*Caves of Qud*. Monospace/pixel-font glyph rendering, a full dev-time
toolchain (map editor, tileset/calibration editor, content browser,
composition wizard, config UI) that stays out of production builds, and
support for static HTML, GitHub Pages, itch.io, and a Steam-compatible
Electron desktop build.

## Status

Planning is complete (`docs/design/`, 11 deep-dive topics). `packages/core`
implementation is complete (sessions 14–25). `packages/input` (physical
input → input-action pipeline) is underway (session 23). `packages/editor`
(dev-time companion tooling, never ships in production) is fully designed
(`docs/design/editor.md`, sessions 26–27) with its hot-reload harness
foundation implemented (session 29); the individual tools (map editor,
content browser, etc.) haven't started. `packages/cli`
(`create-glyphrogue-game` scaffolding) hasn't started. 360 `node --test`
cases pass across the three implemented packages.

Session 30 reconciled a drift between `docs/design/scripting-api.md`'s
Plugin architecture and `packages/core`'s actual generator/behavior code —
see `BACKLOG.md`'s new "packages/core plugin reconciliation roadmap," which
the next `packages/editor` session (plugin management) now depends on.

## See also

- [`DESIGN.md`](./DESIGN.md) — architecture decisions, short summary linking to deep-dives
- [`BACKLOG.md`](./BACKLOG.md) — roadmaps and what's next
- [`docs/design/`](./docs/design/) — in-depth design docs, one per topic
- [`docs/data-model.md`](./docs/data-model.md) — living reference for actual data shapes
- [`docs/glossary.md`](./docs/glossary.md) — terminology reference
- [`docs/session-logs/`](./docs/session-logs/) — one entry per session: goal, decisions, work, deferred items

## Layout

```
packages/
  core/     the runtime engine — implementation complete (sessions 14-25).
            world.js, registry.js, actions.js, scheduler.js, engine.js, api.js,
            save.js, storage.js, rng.js, mapgen.js, zoneComposition.js, zoneDiff.js,
            bsp.js, cellularAutomataGenerator.js, waveFunctionCollapse.js,
            layeredBiome.js, fov.js, pathfinding.js, behaviors.js, glyphMetrics.js,
            glyphRenderer.js, camera.js, renderEvents.js, visibility.js, memory.js,
            animation.js, renderLayers.js, palette.js, fontSources.js, tileset.js,
            pixelyphImport.js, screen.js, sound.js, audio.js, audioLoader.js,
            audioSettings.js, definitions.js, scriptedEvents.js, plugins.js,
            recordingApi.js — under src/, tests under test/
  input/    physical input → input-action pipeline — underway (session 23).
            keymap.js, captureStack.js, inputPipeline.js, stateNotifier.js,
            keyboardSource.js, gamepadSource.js, keybindingStorage.js — kept
            outside core and dependency-free — under src/, tests under test/
  editor/   dev-time companion tools — designed in full (docs/design/editor.md);
            harness foundation implemented (session 29): mount.js, hotReload.js,
            devServerPlugin.js under src/, tests under test/, dev/ fixture for
            manual testing. Individual tools not yet started. Never ships in
            production; Svelte 5 compiled ahead of time, only dist/ published
  cli/      create-glyphrogue-game scaffolding tool — not started
docs/design/       in-depth design docs, one per deep-dive planning session
docs/glossary.md   living terminology reference
docs/session-logs/ one log per session
```
