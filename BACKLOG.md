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
are all complete. Session 26 (originally scoped as "implement the editor
harness," redirected live to a full design survey of `packages/editor`
instead) produced `docs/design/editor.md` — the map editor, tileset/
calibration editor, content browser, composition wizard, config UI, and
the hot-reload harness, plus two `core` extensions the tooling needs
(`registerRule`'s `components` filter + reads/writes tracking, generator
`paramsDefaults`) — see `docs/session-logs/session-26-2026-07-22.md`. See
the "packages/editor design roadmap" below for the proposed implementation
session order. Session 27 was a design-hardening pass over `editor.md`
before implementation starts — no source touched: replaced the Preact+htm
decision with Svelte 5 (compiled ahead of time, only the compiled output
published — the one package with a real build step), fleshed out the
content browser, tileset/font-calibration editor, and config UI layouts
(the last had no described layout at all before this pass), resolved a
`paramsDefaults` migration wrinkle (`layeredBiomeGenerator`'s `seedCount`
default is dynamic, documented as an exception), fully designed plugin
management (folder-per-plugin convention, author-to-author import/export),
pulled the `mods.js` → Plugin rename forward into roadmap item 1, and
split plugin management out of "shared UI infrastructure" into its own
roadmap item since it doesn't depend on either primitive there — see
`docs/session-logs/session-27-2026-07-23.md`. Session 28 completed roadmap
item 1 (the `core` mechanisms bundle plus the pulled-forward Plugin
rename): `registerRule`'s `components` filter and `registerEntityType`
rewiring, dev-mode-only `reads`/`writes` enforcement, `getComponentsForEntity`,
generator `paramsDefaults` plus constant-extraction in `bsp.js`/
`zoneComposition.js`/`waveFunctionCollapse.js`, and `mods.js` → `plugins.js`
(`loadMods` → `loadPlugins`, the save DTO's slice key, `scripting-api.md`'s
terminology per `editor.md`'s Plugin/Mod split) — see
`docs/session-logs/session-28-2026-07-23.md`. `packages/core` test count:
295 → 315 (343 total with `packages/input`'s 28). Session 29 completed
roadmap item 2, the editor harness foundation, run as five checkpoints:
package scaffold + Svelte 5 build step (`mount.js`'s `mountEditor`), a
`dev/` fixture for manual harness testing, `hotReload.js`'s
`snapshotWorld`/`restoreWorldFromSnapshot` (deliberately hot-agnostic,
since Vite keeps only the *last* `hot.dispose()` registration per module —
a caller combining multiple teardown concerns has to register just one),
`devServerPlugin.js`'s shared file-write API (write/exists/touched-files
middleware, path containment, plus a new `writeFileAtomic` primitive
extracted from `packages/core/src/storage.js`), and a real touched-files
panel in `App.svelte` deriving from live `git status` decorated with
per-write provenance — see
`docs/session-logs/session-29-2026-07-23.md`. Also fixed, mid-session:
`storage.js`'s top-level Node-builtin imports crashing any browser
consumer of `@glyphrogue/core` (nothing had loaded it in a real browser
before this session's dev fixture), and the same externalization issue in
`devServerPlugin.js`'s own build step. `packages/editor` test count: 0 →
15 (360 total — this doesn't cleanly reconcile against session 28's 343
total + 15, which is 358; a session-42 documentation audit found the gap
but couldn't determine its source this long after the fact, so it's left
as an acknowledged discrepancy rather than a guessed correction). Session
30 kicked off intending roadmap item 3 (plugin
management) but was redirected live at kickoff: a real drift was found
between `scripting-api.md`'s Plugin architecture (first-party content
should use the same module format as end-user plugins) and `packages/core`'s
actual generator/behavior code (plain exported functions, never
reconciled). Produced `scripting-api.md`'s new "Plugin kinds: Content vs.
Service" (a new Service plugin kind for single-slot, swappable concerns
like `memory`/`audioLoader`, alongside the existing Content model),
`editor.md`'s updated "Plugin management" (two-source discovery, a new
Services selector), `docs/glossary.md`, and this file's new "packages/core
plugin reconciliation roadmap" below — see
`docs/session-logs/session-30-2026-07-23.md`. Also trimmed the root
`README.md` (a mid-session redirect, unrelated to the reconciliation) from
~260 lines of duplicated session narrative down to a short status summary
linking out to `docs/session-logs/`. No code touched, test count unchanged
at 360. Session 31 then implemented the "packages/core plugin
reconciliation roadmap" below in full, six checkpoints (see
`docs/session-logs/session-31-2026-07-23.md`): `api.registerService` +
recording support, the four generators and four behaviors wrapped as
Content plugins (the latter migrating from hand-rolled guards to
`registerRule`'s `components` filter), `memory`/`audioLoader` wrapped as
Service plugins, and a real `loadPlugins` bootstrap in `packages/editor/
dev/main.js`. Test count 360 → 382. Session 32 then completed `packages/
editor` design roadmap item 3 (plugin management), see that roadmap
section below for the full breakdown — `docs/session-logs/
session-32-2026-07-23.md`. Test count 382 → 415 (`packages/core` 339 →
341, `packages/editor` 15 → 46). Session 33 completed `packages/editor`
design roadmap item 4 (shared UI infrastructure) — see that roadmap
section below for the full breakdown, and `docs/session-logs/
session-33-2026-07-24.md`. Test count 415 → 419 (`packages/editor` 46 →
50). Session 34 completed `packages/editor` design roadmap item 5's
standalone-authoring scope (map editor generation, pin/lock, template/
preset export) — kickoff narrowed scope after finding `packages/core` has
no "current zone" concept for in-context editing to build against, and a
mid-session discussion of generator composition split into a kept-in-scope
free affordance (pin/lock + generator-switch) and a deferred new roadmap
item (6, generator composition tool — see that section below). See
`docs/session-logs/session-34-2026-07-24.md`. Test count 419 → 438
(`packages/editor` 50 → 69). Session 35 was a doc-only design pass
resolving item 6's three open questions live in conversation (per
`.claude/dev-session.md`'s convention), landing in `docs/design/editor.md`:
an ordered step-list authoring model (`{ region, generatorId, params }`,
reusing pin/lock + generator catalog + narrow-form rather than new UI),
auto-connect-in-sequence via each primitive's `entryPoint`/`connectCorridor`
(3 of 4 primitives already return one; `carveCellularAutomata` derives its
via the existing `nearestOpenCell` fallback, same as its generator wrapper
already does), and an emitted `src/generators/composed/<name>.js` module
(single default-exported `generatorFn`, overwrite allowed but gated on an
explicit confirmation via the existing `/exists` endpoint, never silent) —
plus a small new "Core extension: expose region-scoped composition
primitives" section (`carveBsp`/`carveCellularAutomata`/`collapseWfc`/
`partitionBiomes`/`connectCorridor` need re-exporting from `index.js`,
currently internal-only). See
`docs/session-logs/session-35-2026-07-24.md`. No code touched, test count
unchanged at 438. Item 6 is now design-complete and ready for
implementation. Session 36 implemented it in full, chosen over item 7 at
kickoff via explicit ask. Kickoff research surfaced three gaps the design
doc's prose didn't cover: `collapseWfc`/`partitionBiomes` need
author-declared `tiles`/`biomes` data no UI can produce yet (resolved per
the user's call — ship all 4 generators with a clearly-marked placeholder
fixture, not a deferral); two more core exports were needed beyond
session 35's five (`nearestOpenCell`, `createZone`); and the doc's stated
emitted signature (`generatorFn(zone, rng, options)`) doesn't match any
real generator in this codebase — every one actually takes `generatorFn(ctx)`
with `ctx.params`/`ctx.rng`, which is what `generateZone` actually calls, so
implementation went against the real convention instead of the doc's stale
prose. Three checkpoints, each verified + committed with an explicit pause
between: core exports; `compositionGenerators.js`/`compositionSteps.js`
(catalog, step-list ops, `composeZone` live-preview execution,
`generateComposedSource` codegen); `CompositionTool.svelte` + `App.svelte`
wiring, verified live in the browser (all four generator types compose
without error, auto-connect visibly bridges regions, and the full
write/exists-check/overwrite-confirm flow round-trips to a real working
generated file). See `docs/session-logs/session-36-2026-07-24.md`. Test
count 438 → 458 (`packages/editor` 69 → 89). Session 37 implemented item 7
(content browser), plain next-in-sequence: kickoff research found
`recordingApi.js`'s `registerRule` stub was silently dropping the
`components` filter every rule registers with, so no manifest `rule` entry
ever carried the data the browser's "component → rules" cross-reference
needs — fixed as the one required core-level prerequisite (no other call
site anywhere relied on the missing data, confirmed by grep). Built
`contentCatalog.js` (`deriveManifest`, `componentIndex`,
`entityTypeRuleIndex`, `filterManifest`) and `ContentBrowser.svelte` (a
registry view over the manifest and a live view over the running world,
plus the entity-type → "show live instances" cross-navigation jump).
Browser verification caught a real bug before commit: the cross-nav jump
initially pre-filtered the live view by only the entity type's *first*
declared component instead of all of them — fixed by adding a dedicated
AND-all `requiredComponents` filter, distinct from the live view's manual
single-component dropdown. See
`docs/session-logs/session-37-2026-07-24.md`. Test count 458 → 466
(`packages/editor` 89 → 97). Session 38 implemented item 8 (the behavior
wizard — connecting entity types to rules, distinct from the generator
composition tool despite the name-collision risk `editor.md` itself
flags). A long plan-mode design conversation, not just kickoff research,
found the doc's original design didn't hold up: "the wizard never writes
a file" turned out to be wrong once `registry.js`'s real
`options.override` mechanism was worked through — a generated composition
plugin can read an already-registered entity type/rule back
(`api.getEntityDefinition`/a new `api.getRule`) and re-register it with
one field changed, entirely by id, never needing to locate the original
definition's source file, which makes it safe to write as a real file
after all. Landed as: `packages/core/src/ruleOverrides.js` (the runtime
dispatcher, `applyRuleOverride`, plus `EntityType`-filter helpers — lives
in `core`, not `editor`, since generated plugin files ship with the
downstream game and import this at real runtime, a correction made
mid-implementation against the plan's own file list), `packages/editor/
src/behaviorWizard.js` (attach/widen matching over `pluginCatalog.js`'s
now-fuller candidate list, composition-array codegen, delete-eligibility),
and `BehaviorWizard.svelte` (a Compositions tab — full create/edit/delete,
entries are plain data safe to regenerate — and a Custom scaffold tab —
one-shot, author-owned the moment it's written, never revisited). Also:
the project's first delete-capable dev-server endpoint
(`devServerPlugin.js`), and three bugs found only during live browser
verification (a `registeredId` gap in `pluginCatalog.js`, a stale browser
module-cache bug in the new discovery function, and a save/delete
catch-22 in the UI's own gating logic) — see
`docs/session-logs/session-38-2026-07-24.md` for details. Test count
466 → 502 (`packages/core` 341 → 353, `packages/editor` 97 → 121). Session
39 implemented item 9 (tileset/font-calibration editor): kickoff research
found `packages/core/src/fontSources.js` had no way to reassign the
calibration reference after the first source registers, despite
`editor.md`'s spec assuming that's possible — confirmed with the user
before planning, then added `setReferenceFontSource` plus a `referenceId`
field. Three checkpoints — core prerequisite + `tilesetCatalog.js` +
fixture wiring, the calibration-tuning tab, and the symbol/tileset
authoring tab — each verified in the dev harness and committed with an
explicit pause between. Browser verification caught a real reactivity bug
(the reference badge wasn't gated on the same `refreshToken` pattern every
other derived value here uses) — fixed before committing. See the
"packages/editor design roadmap" item 9 entry above and
`docs/session-logs/session-39-2026-07-24.md`. Test count 502 → 519
(`packages/core` 353 → 357, `packages/editor` 121 → 134). Session 40
implemented item 10 (config UI), the roadmap's last item: kickoff research
found neither `keyboardSource.js` nor `gamepadSource.js` could report a
raw, not-yet-bound input, so `packages/input/src/captureBinding.js` was
added as a new game-agnostic primitive; the dev fixture also had no audio
asset to preview with, resolved (confirmed with the user) by synthesizing
an in-browser test tone rather than skipping real playback. Three
checkpoints — `captureBinding.js` + the Palette tab, the Keybindings tab
(reusing `captureStack.js` for the "listening" UI), and the Audio tab —
each verified in the dev harness (including against the real Web Audio
API) and committed with an explicit pause between. A real bug surfaced
after checkpoint 3 landed and was reported by the user: `previewMusic`
never overrode `playMusic`'s own `loop: true` default, so the synthesized
test tone played indefinitely with no stop control — fixed by passing
`loop: false` explicitly, committed separately. See the "packages/editor
design roadmap" item 10 entry above and
`docs/session-logs/session-40-2026-07-24.md`. Test count 519 → 562
(`packages/editor` 134 → 164, `packages/input` 28 → 41). **`packages/
editor`'s design roadmap is now fully implemented.**

Session 41 completed `packages/cli` design (web scaffold scope), see
[`docs/design/cli.md`](docs/design/cli.md) and
`docs/session-logs/session-41-2026-07-25.md`. Consolidated the
previously-scattered `build-pipeline.md`/`packaging.md` decisions into one
doc, and resolved four open questions live with the user: the scaffold's
`package.json` writes real semver ranges (e.g. `^0.1.0`) against the
eventual published `@glyphrogue/core`/`@glyphrogue/editor`, never a
workspace-protocol reference, published early under `0.x` rather than
waiting for "polished" (see `cli.md`'s "The pre-publish problem" — the
actual first `npm publish` is a manual prerequisite step for the
*implementation* session, not this one); the CLI prompts for the game name
only, no non-interactive mode yet; each starter content-folder example
hits a deliberately minimal "runs with zero required edits" bar (static
room, one trivial plugin, one pre-calibrated font), not a showcase of
advanced features; template substitution is plain fixed-token string
replacement, no templating engine. Scope was narrowed at kickoff to the
web scaffold only — `packaging.md`'s Electron/Steam material was left out
rather than folded in (see the two new deferred items below). No source
code touched, doc-only session.

Session 42 implemented `packages/cli` (`docs/design/cli.md`), the last
item on the deep-dive/implementation roadmaps. Kickoff resolved the
"pre-publish problem" live: publish happened during the session itself
(the user ran `npm login`/`npm publish` in their own terminal — this
environment's npm wasn't authenticated, and publishing is an external,
irreversible action outside what an agent should do unilaterally
regardless), `@glyphrogue/input` was folded into the publish set alongside
core/editor (`editor`'s `peerDependencies` reference it, so a real install
needs it too, not just the two the backlog literally named), and
`create-glyphrogue-game` itself got published once built and verified —
otherwise `npm create glyphrogue-game` wouldn't resolve for a real user.
Also added: a root MIT `LICENSE` and matching `license`/`description`/
`repository`/`publishConfig` fields on all three prior packages (none of
this existed before this session). Landed as `packages/cli/bin.js`+
`scaffold.js` (prompt → kebab-cased target dir → recursive template copy +
plain token substitution) and `templates/default/` (the two-entry Vite
scaffold, a hand-authored `bootstrap.js`, a 9x7 starter room + one torch
entity/plugin, a CSS-monospace starter font source needing no bundled
binary, the GitHub Pages workflow baked from `pixelyph`'s, and a README
covering Pages + itch.io deploy). Verified end-to-end against the real
published `0.1.0` packages (not a workspace shortcut): a generated
scaffold installs from the registry, both `dev.html`/`index.html` render
correctly, the editor's plugin sidebar reads the real `bootstrap.js`, and
a production build excludes `@glyphrogue/editor`/Svelte entirely. Test
count 562 → 567 (`cli`: 0 → 5 new). Session log:
`docs/session-logs/session-42-2026-07-26.md`. The same session also ran a
full documentation audit at the user's request (three parallel research
passes over `docs/design/`, `BACKLOG.md`, and every README/`DESIGN.md`),
fixing 14 stale/contradictory findings — see the session log for the
full list; not repeated here since none of it changes project status.

All four packages (`@glyphrogue/core`, `@glyphrogue/editor`,
`@glyphrogue/input`, `create-glyphrogue-game`) are now live on npm at
`0.1.0`, and every item on the deep-dive planning roadmap, the
`packages/core` implementation roadmap, and the `packages/editor` design
roadmap is complete.

That decision-session happened next (a separate repo, `glyphkeep` —
`C:\Users\husbando\Claude\glyphkeep`, a haunted-dungeon-crawl roguelite),
and its Phase 1 implementation (glyphkeep sessions 1-2, 2026-07-26) is
now the project's first real dogfooding of `create-glyphrogue-game` and
the public API surface end to end. This repo's own side of that work has
its own session log — `docs/session-logs/session-43-2026-07-26.md` — per
a new convention (any glyphkeep session making real changes here gets a
session log in both repos, not just glyphkeep's). Per
`glyphkeep/.claude/dev-session.md`'s cross-project convention, small
unambiguous gaps found along the way were already fixed directly in this
repo, live: `save.js`'s `deserialize` now
forwards `isWalkable`/`isOpaque` to `createApi` (previously silently
dropped), and `computeFov`/`fovContains` are now exported from
`packages/core`'s public surface (previously implemented/tested but
`api.computeFov`-only). See `glyphkeep/BACKLOG.md`'s "Cross-project issues
found in `glyphrogue`" section for the full writeup of both, including
regression tests already landed here.

Two more fixes landed at that same glyphkeep session's close-out, caught
via glyphkeep's Tokenote companion notes (`glyphkeep/.claude/
tokenote-notes.md`) rather than caught live in the moment they were first
worked around: **`act()`/`run()` (`engine.js`) would hang forever instead
of erroring when called against an empty scheduler** (`next()` returning
`undefined` for "no actors registered" fell straight through to
`dispatchExclusive`/`spend` with `entity=undefined`, which corrupts
`scheduler.actors` with a `NaN`-budget entry that then makes every future
`next()` call return `undefined` too, forever, with no lock ever set to
stop `run()`'s loop — hit when glyphkeep called `run()` before adding its
player as an actor). Fixed with an early-return/loop-break guard, tests
in `engine.test.js`. **`create-glyphrogue-game`'s template shipped with
no `.gitignore`** — every generated game's `node_modules`/`dist` were one
`git add .` away from getting committed. Fixed by adding one to
`templates/default/`, regression test in `packages/cli/test/
scaffold.test.js` asserting the real template copies it through.

Session 44 (2026-07-28) completed the rng-threading + `isWalkableCell`
export work queued below. `createContext`/`dispatch`/`dispatchExclusive`/
`createEngine` now thread `rng` through the same way `mapQuery`/
`renderEvents`/`scheduler` already do, and `ctx.rng` is the same live
object as `api.rng` (confirmed live with the user rather than a derived
copy — see the session log for why) — so a rule's `.next()` calls advance
the one canonical stream `save.js` already serializes via `api.rng.state`.
`rng` is appended *after* `devMode` in every signature, not before —
`actions.test.js` already calls `dispatch`/`dispatchExclusive` with
`devMode` passed positionally, so inserting earlier would have silently
broken those calls. `isWalkableCell` is now re-exported from `index.js`.
Test count 361 → 367 (6 new: rng identity/threading/follow-on/omitted
cases in `actions.test.js`/`engine.test.js`, an `isWalkableCell` surface
test in `index.test.js`). See `docs/session-logs/session-44-2026-07-28.md`.

The glyphkeep fold-back session happened next as planned (glyphkeep's own
session 4, 2026-07-28): `combatRng` swapped for the real `ctx.rng`, and
`isWalkableInZone`/`isOpaqueInZone`/`cellAt` now delegate to the exported
`isWalkableCell` (`cellAt` stays, still needed for raw cell-type rendering
lookup) — no `glyphrogue`-side gap surfaced from that swap.

**glyphkeep's Phase 2** ("full bestiary + boss," session 5, 2026-07-28)
then landed two more small, unambiguous export fixes here, live in the same
posture as every prior fix in this section: `fleesRule` plus the four
behavior priority constants (`FLEES_PRIORITY` etc.) and `DEFAULT_MOVE_COST`
are now re-exported from `index.js` (glyphkeep needed the raw rule function
with a tightened component filter for a health-gated combo enemy, and the
real priority ordering to compose with it correctly; `DEFAULT_MOVE_COST`
also let glyphkeep stop independently redeclaring the same "100" twice for
its own move/turn costs). See `packages/core/test/index.test.js`'s new
regression tests.

**Next `/dev-session` for `glyphrogue` itself**: nothing specific is
queued as a direct follow-on. The three deferred items that were waiting
on glyphkeep's Phase 2 as a second data point are updated below — two
(move-action resolution, camera/FOV/render-loop) got no new evidence and
continue waiting; the third slot is now a genuinely new candidate (no
composition primitive for additive action types, surfaced by Duke
Glyphmund's enrage phase) that's real engine work needing its own
dedicated conversation, not queued for a specific session yet.

Other unblocked candidates, not chosen but still open if priorities
shift: **map editor in-context editing/override export** (deferred from
session 34, no dependency on anything above); the "Deferred / future
items" list below.

## Deferred / future items

- **Should `create-glyphrogue-game` be able to scaffold into a non-empty
  directory?** — surfaced via glyphkeep's Tokenote companion notes
  (`glyphkeep/.claude/tokenote-notes.md`) during Phase 1 checkpoint 1,
  2026-07-26: `targetDirIsUsable` refuses any non-empty target, which
  meant scaffolding into glyphkeep's own already-existing repo (design
  docs, `.claude/`, git history already in place) needed a workaround —
  scaffold to a scratch dir, then copy the generated files in by hand.
  Genuinely ambiguous, not fixed live: allowing it raises real merge-
  semantics questions (overwrite silently? skip existing files? require
  an explicit `--force`? what about a target with its own unrelated
  `package.json`?) that need a real decision, not a guess. Would need its
  own scoped conversation before implementation, same as everything else
  in this list.
- **Move-action resolution as a first-party Content plugin** — surfaced
  by glyphkeep's Phase 1 checkpoint 2 (2026-07-26). All four shipped
  `TakeTurn` behaviors (`wandersRule`/`chasesPlayerRule`/`fleesRule`/
  `guardsRule`) emit `{type: 'Move', entity, to, cost}` follow-ons, but
  nothing in `packages/core` ever resolves one into an actual `Position`
  update — every downstream game has to reinvent this exact rule before
  any of the four behaviors can visibly do anything. Not really a
  glyphkeep-specific gap; arguably a hole in the "first-party AI
  behaviors" story itself. glyphkeep's own version
  (`src/rules.js`'s `moveRule`) is a working reference. The walkability-
  check-plus-`Position`-update core is the strong part of the candidate;
  its bump-to-attack collision policy is more genuinely game-specific
  (a different game might want bump-to-push, or no-op) and probably
  shouldn't come along for the ride as-is. Deliberately not scoped into
  the rng-threading session above — was waiting for glyphkeep's Phase 2
  (combo enemies, a boss) to provide more evidence of what the "right"
  shape actually is before designing this for real. **Phase 2 landed
  (glyphkeep session 5, 2026-07-28) with no new evidence** — `moveRule`
  wasn't touched at all; every new behavior (combo enemies, the boss) still
  emits the exact same `Move` follow-on shape Phase 1 already established.
  Continue waiting, same posture as every other design call in this
  backlog.
- **Camera/FOV/render-loop assembly as scaffold-template boilerplate** —
  surfaced by glyphkeep's Phase 1 checkpoint 1 (2026-07-26). Camera
  (`camera.js`), FOV (`fov.js`), and render-command generation
  (`renderLayers.js`, `visibility.js`) are all real, exported, and
  individually tested, but no consumer anywhere (the CLI scaffold, the
  editor's own preview surfaces) had ever assembled them into a working
  camera-follows-player live-ECS-driven render loop before glyphkeep did.
  Every downstream game needs approximately this same assembly
  (`updateCamera` on the player's `Position`, `computeFov`+
  `classifyVisibility`-gated terrain, live `api.query()`-driven entity
  commands) — plausible material for `create-glyphrogue-game`'s template
  to ship as a real starting point instead of the current static-template
  `renderZone`. glyphkeep's `src/game.js` is a working reference. Was
  waiting for glyphkeep's Phase 2 before locking in a shape, same reasoning
  as the item above. **Phase 2 landed with no new evidence here either** —
  `game.js` only gained more data this phase (new archetypes' symbols/
  colors), not new structural requirements on the camera/FOV/render-loop
  assembly itself, which is unchanged since Phase 1. Continue waiting for
  a phase that actually exercises this surface again, or a second real
  downstream `glyphrogue` game.
- **Keyboard-input wiring as scaffold-template boilerplate** — surfaced
  by glyphkeep's Phase 1 checkpoint 2 (2026-07-26). `@glyphrogue/input`
  is real, published, and fully tested, but had zero real gameplay
  consumers anywhere (not even the CLI scaffold) before glyphkeep wired
  a keymap + `createKeyboardSource` + `createInputPipeline` through to
  `resolvePlayerAction`. Same reusable-boilerplate shape as the render-
  loop item above (a default movement keymap the scaffold could ship),
  same "wait for more evidence" posture. glyphkeep's Phase 2 didn't touch
  `input.js` at all - no new evidence, continue waiting.
- **No composition primitive for additive (`dispatch`) action types,
  unlike exclusive (`dispatchExclusive`) ones** — surfaced by glyphkeep's
  Phase 2 checkpoint 3 (2026-07-28), Duke Glyphmund's enrage phase.
  `dispatchExclusive`'s priority/component-filter resolution already gives
  downstream games a clean way to compose conditionally-scoped rule
  variants for exclusive action types (`TakeTurn`) — glyphkeep's own
  checkpoints 1 and 2 both leaned on exactly this. Nothing equivalent
  exists for additive action types (`Attack` and friends, via `dispatch`):
  `dispatch()` applies *every* matching rule's effect, so two competing
  rules for the same action would double-resolve it, and `registerRule`'s
  `options.override` only supports whole-rule replacement under the same
  id, not a scoped variant for a subset of entities. glyphkeep had to fold
  its enrage bump directly into its own shared `attackRule`
  (`glyphkeep/src/rules.js`) instead of composing it - the only clean
  option available given the current primitives, not a workaround. Three
  glyphkeep checkpoints in a row needed this general shape of thing (see
  `glyphkeep/BACKLOG.md`'s cross-project section, session 5, for the full
  writeup) - genuinely new evidence, but designing a real "rule-result
  modifier/decorator scoped by component filter" for additive types is
  real engine work, not a small fix. Needs its own dedicated conversation;
  not decided here.
- **Electron/Steam scaffold generation for `packages/cli`** —
  `docs/design/packaging.md`'s IPC surface, code-signing, update-strategy,
  and Steam build/upload material is already well-designed but was
  deliberately left out of session 41's `docs/design/cli.md` (web scaffold
  only). Needs its own scoped session to fold in once a real downstream
  game needs desktop/Steam distribution — not a consolidation gap the way
  the web scaffold was, just not yet turned into actual
  scaffold-generation logic. Surfaced 2026-07-25.
- **Richer example projects for `create-glyphrogue-game`** —
  `docs/design/cli.md`'s starter-example bar is deliberately minimal (one
  static room, one trivial plugin, one pre-calibrated font — "runs with
  zero required edits," nothing more). More advanced onboarding examples
  showing off real workflows are worth long-term backlog attention once
  there's appetite to invest in them. Surfaced 2026-07-25.

- **First-class basic screens (main menu, pause menu, inventory/equipment,
  character sheet, settings menu)** — `docs/design/ui-and-input.md`
  explicitly scopes only the generic *system* these are built from
  (`registerScreen`/`PendingUI`, the screen/dialog/menu stack, the pause
  contract), not any actual screen's concrete layout/content: "menus,
  dialogs, inventory/equipment screens... the generic system these are
  built from, not literal screen layouts. Concrete screen designs (an
  actual inventory grid, a specific pause menu) are game content authored
  against this system" — same boundary the tileset pipeline and mapgen
  primitives draw elsewhere against an actual tileset/generator.
  `docs/design/custom-ui-and-interactions.md`'s `'core:dialogue'` (backing
  the `ShowDialogue` scripted-event step) is the **only** screen with any
  first-party implementation anywhere in the codebase — no main menu,
  pause menu, inventory grid, character sheet, or settings menu has ever
  been designed or built. (The Config UI editor tool, `packages/editor`
  design roadmap item 10, is a dev-time authoring surface for tuning
  defaults — it doesn't count toward this either.) Surfaced 2026-07-24
  while reviewing what's left to design/implement; would need its own
  scoped design session(s) before implementation, same as everything else
  in this list.

- **Player-facing Mod management** — `docs/design/editor.md` deliberately
  scopes only dev-time **Plugin** management (author-managed, baked into
  source); a genuinely new `core`-level feature (a persisted,
  player-toggleable enabled-mods settings slice, read at boot) is flagged
  but not designed there, no session scoped for it yet.

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
implementation-roadmap sessions (14-25) are now complete.

## packages/core plugin reconciliation roadmap

Scoped after a real drift was found: `scripting-api.md` (session 5) already
specified that first-party content uses the same Plugin module format as
end-user plugins, but the actual generator/behavior code that landed in
sessions 19-20 never carried that back — they're plain exported functions a
game wires up by hand. `docs/design/scripting-api.md`'s "Plugin kinds:
Content vs. Service" and `docs/design/editor.md`'s updated "Plugin
management" now specify the reconciled design; this roadmap is the
implementation work to make `packages/core`'s actual code match it. Strict
dependency order — each step's plugin wrapper needs the primitive below it:

1. ~~**`api.registerService` + recording-api support**~~ — done (session
   31), see `docs/session-logs/session-31-2026-07-23.md`. `api.js`'s
   `createApi()` restructured to a named `const` (was an anonymous
   returned literal) so `registerService(id, implementation)` can
   `Object.assign` the implementation onto that same live object;
   `recordingApi.js` got the matching `{ kind: 'service', id }` stub.
2. ~~**Wrap the four generators as Content plugins**~~ — done (session
   31). `packages/core/src/generatorPlugins.js`: `bspPlugin`/
   `cellularAutomataPlugin`/`wfcPlugin`/`layeredBiomePlugin`
   (content/plugin ids `'bsp'`/`'cellular-automata'`/`'wfc'`/
   `'layered-biome'`), each registering with whatever `paramsDefaults`
   constants already existed for it (`cellular-automata` and
   `layered-biome`'s `seedCount` get none, per the documented exceptions).
3. ~~**Wrap the four behaviors as Content plugins**~~ — done (session
   31). `packages/core/src/behaviorPlugins.js`: `wandersPlugin`/
   `chasesPlayerPlugin`/`fleesPlugin`/`guardsPlugin`, each using
   `registerRule`'s `components` filter (`{ all: [marker] }`) rather than
   a hand-rolled guard — `behaviors.js`'s rule bodies had their now-
   redundant marker-component checks removed as part of this step, not
   left duplicated.
4. ~~**Wrap `memory.js` as a Service plugin**~~ — done (session 31),
   `packages/core/src/servicePlugins.js`'s `memoryPlugin` (`id: 'memory'`
   — pinned, since dependents/override plugins both declare it by that
   exact name).
5. ~~**Wrap `audioLoader.js` as a Service plugin**~~ — done (session 31),
   same file's `audioLoaderPlugin` (`id: 'audioLoader'`).
6. ~~**Give `packages/editor/dev/`'s fixture a real bootstrap**~~ — done
   (session 31). `packages/editor/dev/main.js` calls `loadPlugins` with
   all ten plugins unconditionally right after `createApi()`/restore —
   plugin registrations aren't part of the serialized world snapshot, so
   they need registering fresh every run, restored or not. Verified
   manually in-browser: all 8 content ids and both service methods
   present on the live api, no console/server errors, existing
   touched-files panel unaffected.

`packages/core` test count: 339 (317 → 318 → 326 → 333 → 339 across the
six steps above; 382 total with `packages/editor`'s 15 and
`packages/input`'s 28). `packages/editor` design roadmap item 3 (Plugin
management, below) is now unblocked.

## packages/editor design roadmap

Scoped in session 26's design survey (`docs/design/editor.md`) after the
`packages/core` implementation roadmap finished. Dependency order, not a
fixed commitment — each session's own kickoff should still confirm scope
live against real code, same caveat every roadmap in this file carries.

1. ~~**`core` mechanisms bundle**~~ — done (session 28), see
   `docs/session-logs/session-28-2026-07-23.md`. `registerRule`'s
   `components` filter + `registerEntityType` rewiring, generator
   `paramsDefaults` + the four first-party generators' constant-extraction
   fix (`layeredBiomeGenerator`'s `seedCount` stayed a documented
   exception, its `biomes.length * 2` default is dynamic), the dev-mode
   reads/writes enforcing `ctx` wrapper, `getComponentsForEntity`. Plus the
   pulled-forward `mods.js` → Plugin renaming pass (`loadMods` →
   `loadPlugins`, `mods.js` → `plugins.js`, the save DTO's `plugins:` slice
   key, `scripting-api.md`'s terminology per a careful per-section pass,
   `mods.test.js` → `plugins.test.js`). `packages/cli`'s half of the
   rename turned out to be documentation-only (`build-pipeline.md`'s one
   `src/mods/` mention) since no CLI scaffold exists on disk yet.
2. ~~**Editor harness foundation**~~ — done (session 29), see
   `docs/session-logs/session-29-2026-07-23.md`. Package scaffold + Svelte
   5 build step (`mount.js`'s `mountEditor(container, api)`, currently
   mounting a placeholder-turned-touched-files-panel root), a `dev/`
   fixture, `hotReload.js`'s hot-agnostic `snapshotWorld`/
   `restoreWorldFromSnapshot` (a real downstream game's own dev bootstrap
   combines this with any other `hot.dispose()` teardown into one call —
   Vite only keeps the last registration per module), `devServerPlugin.js`'s
   `createFileWriteApi()` (write/exists/touched-files middleware, path
   containment, `writeFileAtomic` extracted from
   `packages/core/src/storage.js`), and the touched-files log itself
   (derived from live `git status --untracked-files=all` decorated with
   per-write provenance). Everything below mounts inside this.
3. ~~**Plugin management**~~ — done (session 32), see
   `docs/session-logs/session-32-2026-07-23.md`. `packages/core/src/
   corePlugins.js`'s `CORE_PLUGINS` aggregate export; `devServerPlugin.js`'s
   `/plugins/discover` (`bootstrapPath` option, `src/plugins/` directory
   scan, `parseBootstrapSource`'s lightweight import/loadPlugins-array text
   scan) and `/plugins/import`+`/plugins/export` (plain recursive folder
   copy, `isValidPluginId` path-traversal guard); `packages/editor/src/
   pluginCatalog.js`'s browser-safe `deriveCatalog` (dynamic import +
   `recordingApi` is the only way to observe a candidate's Content-vs-
   Service kind, since no plugin object carries a static `kind` field),
   `buildToggleInstruction`/`buildServiceSwitchInstruction` (toggling never
   writes the bootstrap file directly, only surfaces a copy-ready
   instruction, per `editor.md`), and `checkPluginLoadErrors` (a
   `loadPlugins` dry run against `recordingApi`, surfacing dependency-cycle/
   version-mismatch errors as UI feedback instead of a console throw).
   `PluginList.svelte`/`PluginServices.svelte`, mounted in `App.svelte`.
   `packages/editor` test count: 15 → 46. Verified end-to-end in-browser
   against a new `dev/sandbox/bootstrap.js` + `dev/sandbox/src/plugins/
   sample-plugin/` fixture (`dev/main.js` couldn't double as the scanned
   bootstrap — it mounts the editor itself).
4. ~~**Shared UI infrastructure**~~ — done (session 33), see
   `docs/session-logs/session-33-2026-07-24.md`. `LivePreview.svelte`, a
   thin wrapper around core's existing `paintLayer` (needed no new core
   code — the command shape was already generic enough for a swatch,
   assembled tile, and small terrain grid alike), and `narrowForm.js` +
   `NarrowForm.svelte`, scoped to exactly the flat `paramsDefaults`/
   audio-mixing shape (`typeof`-inferred number/boolean/string controls,
   no min/max/enum metadata layer — a live design fork resolved with the
   user). Both verified via dev-fixture demo panels in `App.svelte` (no
   real consumer tool exists yet); BSP-params demo derives its defaults
   live from the registry rather than hand-copying them.
   `packages/editor` test count: 46 → 50. 419 total.
5. ~~**Map editor**~~ — standalone-authoring scope done (session 34), see
   `docs/session-logs/session-34-2026-07-24.md`. `generatorCatalog.js`,
   `zoneRender.js`, `pinRegion.js`, `mapEditorExport.js`, `MapEditor.svelte`
   — generate/tune a scratch zone, pin/lock a region (including pin +
   generator-switch, a free interactive composition affordance), export a
   template fragment or seed+params preset via the shared file-write API.
   **In-context editing and override export remain undone** — deferred at
   kickoff since `packages/core` has no "current zone" concept to build the
   `currentZoneId` accessor against yet; needs a later session once there's
   a clearer real-game harness to design that against.
   `packages/editor` test count: 50 → 69.
6. ~~**Generator composition tool**~~ — done (session 36), see
   `docs/design/editor.md`'s "Generator composition tool" section and
   `docs/session-logs/session-36-2026-07-24.md`. Distinct from the map
   editor's pin/lock (hand-authoring a specific static map with generator
   help, already in item 5's scope): lets an author assemble multiple
   generators against different regions of a zone via an ordered step list
   (`{ region, generatorId, params }`, reusing pin/lock + generator catalog
   + narrow-form), auto-connecting regions in step order via each
   primitive's `entryPoint` + `connectCorridor`, then **emits real JS
   source** — a single default-exported `generatorFn` at
   `src/generators/composed/<name>.js` — a reusable procedural composition,
   re-seeded fresh every generation, not a frozen captured layout (which
   the map editor's template export already covers), and an alternative to
   hand-writing the same composition directly, not a replacement for it.
   Overwriting an existing composed file is allowed but requires an
   explicit confirmation (via the shared file-write API's existing
   `/exists` endpoint), never silent. Session 19 originally parked "a
   worked example of composing multiple algorithms into one zone" as a
   deferred item; this is that need, scoped as an editor-driven codegen
   tool rather than a hand-written example.
   `carveBsp`/`carveCellularAutomata`/`collapseWfc`/`partitionBiomes`/
   `connectCorridor` (session 35) plus `createZone`/`nearestOpenCell`
   (session 36 — two more the design doc didn't anticipate) are exported
   from `packages/core/src/index.js`.
   `compositionGenerators.js`/`compositionSteps.js`/`CompositionTool.svelte`
   implement it: the emitted `generatorFn(ctx)` matches every real
   generator's actual signature (the design doc's stated
   `(zone, rng, options)` didn't match any real generator, a correction
   made against working code); `collapseWfc`/`partitionBiomes` ship with a
   clearly-marked placeholder `tiles`/`biomes` fixture since no UI can
   author that data yet.
   `packages/editor` test count: 69 → 89.
7. ~~**Content browser**~~ — done (session 37), see
   `docs/session-logs/session-37-2026-07-24.md`. `contentCatalog.js`
   (`deriveManifest` re-runs `loadPlugins` against a fresh `recordingApi`,
   reusing `pluginCatalog.js`'s already-computed `enabledPlugins`;
   `componentIndex`/`entityTypeRuleIndex`, the two static cross-reference
   indexes `editor.md` describes; `filterManifest`, one function backing
   kind/search/cross-reference list filtering) and `ContentBrowser.svelte`
   (registry view over the manifest, live view over `api.query([])`/
   `getComponentsForEntity`, and the entity-type → "show live instances"
   cross-navigation jump). A real gap in `recordingApi.js`'s `registerRule`
   stub (silently dropping the `components` filter every rule registers
   with) was fixed as this session's one required core-level prerequisite.
   `packages/editor` test count: 89 → 97.
8. ~~**Behavior wizard**~~ — done (session 38), see
   `docs/session-logs/session-38-2026-07-24.md`. Connects entity types to
   rules (not the generator composition tool, despite the doc's flagged
   name collision) — `packages/core/src/ruleOverrides.js` (runtime
   dispatcher + `EntityType`-filter helpers), `packages/editor/src/
   behaviorWizard.js` (attach/widen matching, composition-array codegen,
   delete-eligibility), `BehaviorWizard.svelte` (Compositions tab — full
   CRUD, entries are plain data — and a one-shot Custom scaffold tab).
   `docs/design/editor.md`'s "Composition wizard" section still describes
   the original (superseded) design and needs a correction pass — not
   done this session, same follow-up debt session 36 had for the
   generator tool's doc.
   `packages/editor` test count: 97 → 121. 502 total.
9. ~~**Tileset/font-calibration editor**~~ — done (session 39), see
   `docs/session-logs/session-39-2026-07-24.md`. Kickoff found
   `packages/core/src/fontSources.js` had no way to reassign the
   calibration reference after the first source registers, despite
   `editor.md` assuming that's possible — added `setReferenceFontSource`
   plus a `referenceId` field for the UI to badge correctly, and confirmed
   with the user before planning. `registerFontSource` always internally
   re-derives calibration (no parameter for a caller-supplied one), so
   slider edits mutate the raw registry directly via `options.override`
   instead of routing through it.
   `packages/editor/src/tilesetCatalog.js` (enumeration/filtering:
   `listFontSourceIds`, `getFontSourceEntry`, `isReferenceFontSource`,
   `listSymbolIds`, `getSymbolEntry`, `filterSymbols`, `hasGlyphManifest`,
   `UNICODE_BLOCK_PRESETS`/`presetCodepoints`, `buildCalibrationCommands`)
   and `TilesetEditor.svelte` (calibration tuning tab + symbol/tileset
   authoring tab) implement it — `NarrowForm.svelte` deliberately not
   reused for the calibration sliders, per `editor.md`'s own "Narrow shared
   form primitive" section (`horizontalCenteringMode`'s fixed enum can't
   come from `typeof`-based inference). Browser verification caught a real
   reactivity bug (the reference badge read the live registry directly in
   the template with no `refreshToken` gate) — fixed before committing.
   `packages/editor` test count: 121 → 134.
10. ~~**Config UI**~~ — done (session 40), see
    `docs/session-logs/session-40-2026-07-24.md`. Three tabs: Palette
    (`configPalette.js` — recursive token/gradient row derivation and
    `export default {...}` serialization; the gradient stop editor covers
    both raw colors and one-level `{ token }` references, per
    `palette.js`'s own resolution rule), Keybindings (`configKeybindings.js`
    plus a new `packages/input/src/captureBinding.js` primitive — raw
    next-key/button/axis capture, independent of `resolveBinding`, reusing
    `captureStack.js` for the "listening" UI per `editor.md`'s existing
    capture-stack decision), and Audio (`configAudio.js` — an in-browser
    synthesized test tone plus `master × channel` volume mixing, since the
    dev fixture has no real sound asset; previews through the real
    `playMusic`/`playSound`). Every tab shares the Map Editor/Composition
    Tool's author-specified destination-path + overwrite-confirm write
    pattern, since no "default-settings source" file convention existed
    yet to hardcode against. `packages/editor` test count: 134 → 164
    (`packages/input` 28 → 41).

`packages/editor`'s design roadmap is now **fully implemented** — item 10
was the last item.

`packages/cli` remains later, separately-scoped work — this roadmap covers
`packages/editor` only, same relationship the `packages/core`
implementation roadmap had to `packages/editor`/`packages/cli` before it.

After each session, check off the completed item here and move the NEXT
SESSION pointer to the following one, same convention as the deep-dive
roadmap above.
