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
foundation (session 29), plugin management (session 32), shared UI
infrastructure (session 33), the map editor's standalone-authoring scope
(session 34), and the generator composition tool (session 36) implemented;
in-context editing/override export and the remaining individual tools
(content browser, etc.) haven't started. `packages/cli`
(`create-glyphrogue-game` scaffolding) hasn't started. 458 `node --test`
cases pass across the three implemented packages.

Session 30 reconciled a drift between `docs/design/scripting-api.md`'s
Plugin architecture and `packages/core`'s actual generator/behavior code;
session 31 implemented that reconciliation in full — the four built-in
generators and four AI behaviors now ship as Content plugins
(`generatorPlugins.js`, `behaviorPlugins.js`), `memory`/`audioLoader` ship
as Service plugins (`servicePlugins.js`) via the new `api.registerService`,
and the editor's `dev/` fixture bootstraps all ten via `loadPlugins`. Session
32 then built plugin management on top of that: a combined core-bundled +
author-authored Content list, a per-slot Services selector, folder-per-plugin
import/export, and dependency/version error surfacing — all discovery runs
through `pluginCatalog.js`'s `deriveCatalog` (dynamic import + `recordingApi`
is the only way to observe a candidate's Content-vs-Service kind) and every
enable/disable/switch surfaces a copy-ready bootstrap-edit instruction rather
than writing the author's hand-authored bootstrap file directly. Session 33
then built the two shared primitives every remaining tool depends on:
`LivePreview.svelte`, a thin wrapper around core's existing `paintLayer`
(needed no new core code at all), and `NarrowForm.svelte` + `narrowForm.js`,
scoped to exactly the flat `paramsDefaults`/audio-mixing shape per
`editor.md`'s own narrow-scoping decision. Session 34 then built the map
editor's standalone-authoring scope on top of those primitives: generate/
tune a scratch zone (`generatorCatalog.js`, `zoneRender.js`), pin/lock a
region including pin + generator-switch composition
(`pinRegion.js`), and export a template fragment or seed+params preset
(`mapEditorExport.js`) — all in `MapEditor.svelte`, replacing the prior
session's throwaway demo panels in `App.svelte`. In-context editing and
override export stay deferred (no "current zone" concept exists in
`packages/core` yet); a real generator-composition codegen tool was scoped
as a new, separate roadmap item rather than built ad hoc. See
`BACKLOG.md`'s "packages/editor design roadmap" item 5. Session 35 was a
doc-only design pass resolving that item (6, generator composition tool):
an ordered step-list authoring model, auto-connect-in-sequence via each
generator primitive's existing `entryPoint`, and an emitted
`src/generators/composed/<name>.js` module (overwrite allowed but gated on
an explicit confirmation, never silent) — see `docs/design/editor.md`'s
"Generator composition tool" section. It also exported the five
region-scoped composition primitives (`carveBsp`, `carveCellularAutomata`,
`collapseWfc`, `partitionBiomes`, `connectCorridor`) from
`@glyphrogue/core`'s public `index.js`, previously internal-only — the
tool's one code prerequisite. Session 36 implemented item 6 in full:
`compositionGenerators.js` (the four composable generators, including a
clearly-marked placeholder `tiles`/`biomes` fixture for
`collapseWfc`/`partitionBiomes`, which need author-declared data no UI can
produce yet), `compositionSteps.js` (step-list ops, live-preview
composition, and codegen emitting a real `generatorFn(ctx)` matching every
actual generator's signature, correcting the design doc's stale
`(zone, rng, options)` prose), and `CompositionTool.svelte`. Two more small
core exports (`createZone`, `nearestOpenCell`) were needed beyond session
35's five. See `docs/session-logs/session-36-2026-07-24.md`. The next
`/dev-session` is item 7 (content browser), plain next-in-sequence.

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
            recordingApi.js, generatorPlugins.js, behaviorPlugins.js,
            servicePlugins.js, corePlugins.js — under src/, tests under test/
  input/    physical input → input-action pipeline — underway (session 23).
            keymap.js, captureStack.js, inputPipeline.js, stateNotifier.js,
            keyboardSource.js, gamepadSource.js, keybindingStorage.js — kept
            outside core and dependency-free — under src/, tests under test/
  editor/   dev-time companion tools — designed in full (docs/design/editor.md);
            harness foundation (session 29), plugin management (session 32),
            shared UI infrastructure (session 33), the map editor's
            standalone-authoring scope (session 34), and the generator
            composition tool (session 36) implemented: mount.js,
            hotReload.js, devServerPlugin.js, pluginCatalog.js, narrowForm.js,
            generatorCatalog.js, zoneRender.js, pinRegion.js,
            mapEditorExport.js, compositionGenerators.js, compositionSteps.js,
            App.svelte, PluginList.svelte, PluginServices.svelte,
            LivePreview.svelte, NarrowForm.svelte, MapEditor.svelte,
            CompositionTool.svelte under src/, tests under test/, dev/ fixture
            (including dev/sandbox/bootstrap.js, a stand-in game bootstrap)
            for manual testing. Map editor in-context editing/override
            export and remaining individual tools (content browser, etc.)
            not yet started. Never ships in production; Svelte 5 compiled
            ahead of time, only dist/ published
  cli/      create-glyphrogue-game scaffolding tool — not started
docs/design/       in-depth design docs, one per deep-dive planning session
docs/glossary.md   living terminology reference
docs/session-logs/ one log per session
```
