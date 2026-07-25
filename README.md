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
(session 34), the generator composition tool (session 36), the content
browser (session 37), the behavior wizard (session 38), the tileset/
font-calibration editor (session 39), and config UI (session 40)
implemented — every item in the `packages/editor` design roadmap is now
built; only map editor in-context editing/override export remains
deferred. `packages/cli` (`create-glyphrogue-game` scaffolding) is
designed in full for its web-scaffold scope (`docs/design/cli.md`, session
41); implementation hasn't started. 562 `node --test` cases pass across
the three implemented packages.

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
35's five. See `docs/session-logs/session-36-2026-07-24.md`. Session 37
implemented item 7 (content browser): `contentCatalog.js` (manifest
derivation via `recordingApi` — a small `registerRule` gap fixed along
the way, since the stub was silently dropping the `components` filter
every rule registers with — plus the two static cross-reference indexes
`editor.md` describes, component → rules and entity type → rules) and
`ContentBrowser.svelte` (a registry view over that manifest and a live
view over the running world's actual entities, with a "show live
instances" cross-navigation jump between them). See
`docs/session-logs/session-37-2026-07-24.md`. Session 38 implemented item
8 (the behavior wizard — connecting entity types to rules, not to be
confused with the generator composition tool): a plan-mode design
conversation found the doc's original "never writes a file" premise
didn't hold up against `registry.js`'s real `options.override` mechanism,
so the implementation instead has a generated composition plugin read an
already-registered entity type/rule back (`api.getEntityDefinition`/the
new `api.getRule`) and re-register it with one field changed — safe to
write as a real file since it never needs to locate the original
definition's source. `packages/core/src/ruleOverrides.js` holds the
runtime dispatcher generated plugins import; `packages/editor/src/
behaviorWizard.js` holds the dev-time attach/widen matching and codegen;
`BehaviorWizard.svelte` adds Compositions (full create/edit/delete, entries
are plain data) and Custom scaffold (one-shot, author-owned from the
moment it's written) tabs. Also added: the project's first delete-capable
dev-server endpoint. See `docs/session-logs/session-38-2026-07-24.md`.
Session 39 implemented item 9 (the tileset/font-calibration editor): two
tabs, calibration tuning (per font-source `scale`/`baselineOffset`/
`horizontalCenteringMode` sliders + a live calibration-grid preview, plus a
confirmation-gated "set as reference" action) and symbol/tileset authoring
(a searchable symbol table, a glyph picker branching on whether a font
source has a real Pixelyph manifest to browse or falls back to raw hex
input + Unicode block-range presets, and palette-token color pickers).
Kickoff research found `fontSources.js` had no way to change the
calibration reference after the first source registers, despite the design
doc assuming that's possible — added `setReferenceFontSource` plus a
`referenceId` field for the UI to badge correctly.
`packages/editor/src/tilesetCatalog.js` holds the pure enumeration/
filtering logic; `TilesetEditor.svelte` is the UI. Browser verification
caught a real reactivity bug (the reference badge wasn't updating after a
reference change, since it read the live registry directly in the template
instead of through the same `refreshToken`-gated pattern every other
derived value here uses) — fixed before committing. See
`docs/session-logs/session-39-2026-07-24.md`. Session 40 implemented item
10 (config UI), the design roadmap's last item: three tabs (Palette /
Keybindings / Audio), each tuning a different underlying mechanism but all
writing the tuned result to project source via the shared file-write API.
Kickoff research found two real gaps behind the spec: neither
`keyboardSource.js` nor `gamepadSource.js` could report a raw,
not-yet-bound input (both only ever resolve already-mapped actions), so
`packages/input/src/captureBinding.js` was added as a new, game-agnostic
"listen for the next raw key/button/axis" primitive the Keybindings tab's
rebind affordance builds on; and the dev fixture had no audio asset to
preview with, resolved (confirmed with the user) by synthesizing an
in-browser sine-wave test tone (`configAudio.js`) rather than skipping
real playback. `configPalette.js` handles the recursive token/gradient
structure (a token is a raw color or a gradient whose own stop colors may
be one-level token references); `configKeybindings.js` handles the
per-action binding list and reuses `captureStack.js` for the "listening"
UI, per `editor.md`'s existing capture-stack decision. Browser
verification caught a real bug after checkpoint 3 landed: `previewMusic`
never overrode `playMusic`'s own `loop: true` default, so clicking
"Preview music" started audio with no way to stop it from the UI — fixed
by passing `loop: false` explicitly, matching `previewSfx`'s already-
correct non-looping behavior. See
`docs/session-logs/session-40-2026-07-24.md`. `packages/editor`'s design
roadmap is now fully implemented. Session 41 was a doc-only design pass
for `packages/cli` (`create-glyphrogue-game` scaffolding, web-scaffold
scope): see `docs/design/cli.md` — the scaffold's `package.json` targets
real semver ranges against the eventual published
`@glyphrogue/core`/`@glyphrogue/editor` (never a workspace reference),
published early under `0.x` once a first release is cut, rather than
waiting for "polished"; the CLI prompts for the game name only; each
starter content-folder example hits a deliberately minimal "runs with
zero required edits" bar; template substitution is plain fixed-token
string replacement. Electron/Steam scaffold generation
(`docs/design/packaging.md`'s material) was left out of scope, deferred to
its own future session. See `docs/session-logs/session-41-2026-07-25.md`.
The next `/dev-session` is `packages/cli` implementation of that doc
(gated on a manual first `npm publish` at `0.1.0`), or map editor
in-context editing/override export.

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
            servicePlugins.js, corePlugins.js, ruleOverrides.js — under
            src/, tests under test/
  input/    physical input → input-action pipeline — underway (session 23).
            keymap.js, captureStack.js, inputPipeline.js, stateNotifier.js,
            keyboardSource.js, gamepadSource.js, keybindingStorage.js,
            captureBinding.js (raw next-input capture, session 40) — kept
            outside core and dependency-free — under src/, tests under test/
  editor/   dev-time companion tools — designed in full (docs/design/editor.md);
            every item in the design roadmap now implemented: harness
            foundation (session 29), plugin management (session 32), shared
            UI infrastructure (session 33), the map editor's
            standalone-authoring scope (session 34), the generator
            composition tool (session 36), the content browser (session 37),
            the behavior wizard (session 38), the tileset/font-calibration
            editor (session 39), and config UI (session 40): mount.js,
            hotReload.js, devServerPlugin.js, pluginCatalog.js, narrowForm.js,
            generatorCatalog.js, zoneRender.js, pinRegion.js,
            mapEditorExport.js, compositionGenerators.js, compositionSteps.js,
            contentCatalog.js, behaviorWizard.js, tilesetCatalog.js,
            configPalette.js, configKeybindings.js, configAudio.js,
            App.svelte, PluginList.svelte, PluginServices.svelte,
            LivePreview.svelte, NarrowForm.svelte, MapEditor.svelte,
            CompositionTool.svelte, ContentBrowser.svelte,
            BehaviorWizard.svelte, TilesetEditor.svelte, ConfigUI.svelte
            under src/, tests under test/, dev/ fixture (including
            dev/sandbox/bootstrap.js, a stand-in game bootstrap) for manual
            testing. Map editor in-context editing/override export remains
            deferred. Never ships in production; Svelte 5 compiled ahead of
            time, only dist/ published
  cli/      create-glyphrogue-game scaffolding tool — designed in full
            (docs/design/cli.md, web-scaffold scope, session 41);
            implementation not yet started
docs/design/       in-depth design docs, one per deep-dive planning session
docs/glossary.md   living terminology reference
docs/session-logs/ one log per session
```
