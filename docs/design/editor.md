# packages/editor: dev-time companion tooling

Deep-dive design doc for `packages/editor` — the map editor, tileset/
calibration editor, content browser, composition wizard, config UI, and the
hot-reload dev harness they all run inside. Produced in the session-26
planning pass (see `BACKLOG.md` for the roadmap this fits into). Treat this
as the source of truth for the topics below, same pattern as the other
`docs/design/` entries.

This doc also extends two already-decided mechanisms rather than
introducing parallel ones: `core-architecture.md`'s action/rule pipeline
gains `registerRule`'s `components` filter and reads/writes declarations,
and `mapgen-and-editor.md`'s generator interface gains `paramsDefaults`.
Both are `core`-level additions motivated entirely by this doc's tooling
needs, cross-referenced from those docs rather than silently overriding
them.

## Framing: an IDE companion, not a replacement IDE

**Decision**: `packages/editor` is a companion to an author's existing code
editor (VS Code or whatever), not a replacement for one. Authors keep
writing actual game logic in their own editor; the companion's job is
specifically the things a text editor is *structurally* unable to do well:

- **Live rendering + interactive tuning** — map preview/generation,
  glyph/tileset calibration, palette preview, audio mixing preview.
- **Runtime introspection** — what's actually registered and how it's
  wired, derived from the live engine, not statically readable from source
  alone.

Anything that's just "editing a file" stays the author's own editor's job.
Outputs of companion-side tools (a tuned zone override, calibration
numbers, a captured keybinding, a scaffolded resource) get **written back
to the project's real source/data files** so they become ordinary project
content afterward — the one piece of infrastructure nearly every feature
in this doc shares (see "Shared file-write API" below).

`packages/cli`'s scope is unaffected by this doc — it stays one-time
project bootstrap (`build-pipeline.md`); the companion is what an author
runs *alongside* their own editor afterward, not a replacement for either.

## The dev-time / player-facing split: Plugin vs. Mod

**Decision**: this doc reserves **Plugin** for dev-time, author-managed
additions, and **Mod** for player-facing, runtime-toggleable content —
both previously called "mod" elsewhere in this project, which becomes
ambiguous once player-facing runtime toggling is a distinct idea.

Both can share the same underlying mechanism (`core`'s existing
`mods.js`/`loadMods`, id/version/dependency validation) — they differ only
in *where the array of what-to-load comes from*:

- **Plugin** — the array is author-decided, baked into source, edited via
  the editor's **plugin management** feature (below). This is the only one
  of the two in scope for `packages/editor` — explicitly dev-time only.
- **Mod** — the array would be constructed from a persisted settings slice
  a player toggles via an in-game menu, read at boot. **Does not exist
  today** — nothing in `core` currently tracks enabled/disabled state for
  anything modding-related. Genuinely new `core`-level work, out of scope
  for this doc.

**Renaming consequence**: everything that exists today in `core` uses
"mod" for what this doc calls "Plugin" — `packages/core/src/mods.js`,
`scripting-api.md`, the save DTO's `mods: { [modId]: ... }` slice. Scoped
into the very next implementation session (`BACKLOG.md`'s "packages/editor
design roadmap" item 1, alongside the `core` mechanisms bundle below) —
`loadMods` → a `loadPlugins`-equivalent, `mods.js` → `plugins.js`, the
save-slice key, `scripting-api.md`'s terminology, and the CLI scaffold's
`src/mods/` → `src/plugins/` folder. No source renamed in this doc itself
— that's implementation, not design — but no longer an open-ended
someday.

## Core extension: `registerRule`'s `components` filter

**Decision**: `registerRule` gains an optional `components` filter that
`actions.js`'s dispatch pipeline enforces *before* calling `ruleFn` at all,
replacing the current convention of a rule hand-rolling `ctx.hasComponent`/
`ctx.getComponent` checks inside its own function body. The declaration
**is** the behavior enforced at dispatch time, so there's nothing to drift
out of sync the way a purely descriptive metadata field would risk.

```js
registerRule(registry, 'goblin-cast-spell', 'TakeTurn', castSpellRuleFn, {
  components: {
    all: [
      { component: 'EntityType', equals: { type: 'Goblin' } },
      'Shaman',
    ],
    any: [
      { component: 'Class', in: { role: ['Mage', 'Shaman', 'Warlock'] } },
    ],
    none: [
      { component: 'Status', equals: { effect: 'Silenced' } },
    ],
  },
})
```

- A **string** entry (`'Shaman'`) is a presence-only check for that
  component type.
- An **object** entry (`{ component, ...operators }`) is a presence check
  plus field-level comparisons. Every operator is field-keyed identically
  — `fieldName → value` for `equals`/`notEquals`/`gt`/`gte`/`lt`/`lte`,
  `fieldName → array` for `in`/`notIn` (SQL `IN`-style set membership).
  Multiple operators and fields freely combine on one entry, all ANDed.
- **Partial/subset matching**, not exact whole-object equality — only the
  named fields are checked; other fields on the actual component are
  ignored. This is deliberate: a filter written today keeps working if a
  component's data shape grows new fields later, where exact-match
  semantics would silently break the moment an unrelated field appeared.
- `all`/`any`/`none` combine with implicit AND between buckets; `any` is
  OR across its own list; `none` is exclusion. This covers cases like
  "Goblin AND Shaman" (`all`) alongside a separate OR-group in the same
  rule, which a single list-plus-mode-flag design couldn't express.
- Scoped to `action.entity` — applies to action types that reference a
  single entity, not a universal mechanism for entity-less actions.
- Deliberately **not** a full nested boolean expression language — no
  arbitrary AND/OR/NOT trees. If a rule genuinely needs OR-of-AND-groups,
  register the same rule twice under two different filters; `dispatch`
  already runs every matching entry.

**Decision**: `registerEntityType` is rewired on top of this rather than
kept as a separate mechanism. Its existing auto-injected check
(`EntityType.type === id`) is exactly expressible as `{ component:
'EntityType', equals: { type: id } }` in an `all` list — the sugar should
generate this filter internally via `registerRule` instead of hand-rolling
its own inline wrapping logic the way `definitions.js` does today. One
general mechanism serves both the new use case and the pre-existing
special case, not two mechanisms living side by side.

### Rules' fuller reads/writes tracking

The `components` filter above covers presence/value **gating** — which
entities a rule can even fire for — but not "what does this rule actually
read/write once it runs, including other entities touched via
`ctx.query`" (e.g. a chase behavior reading the *player's* `Position`, not
just the acting entity's).

**Decision**: build this now, as an optional declared `{ reads, writes }`
per rule (`registerRule(..., { reads: ['Position'], writes: ['Health'] })`
), made **load-bearing via an optional dev-mode-only `ctx` wrapper** rather
than staying purely descriptive. When running under the editor's harness
— never in a shipped production game — `ctx.getComponent`/`addComponent`
get wrapped to check every access against the rule's declared list and
throw immediately if a rule touches something undeclared. This piggybacks
on ordinary play-testing under the harness rather than needing static
analysis or a synthetic dry-run: any branch a developer actually exercises
during normal dev-time play gets validated for free. An unexercised branch
just isn't checked yet, the same coverage caveat a dry-run trace would
have — but tied to real usage instead of one artificial call. Zero
production cost, since the wrapper only exists in dev mode. Opt-in per
rule, independent of the load-bearing `components` gating filter — not
every rule needs to participate in the interconnection graph.

Considered and rejected: a purely descriptive schema with no enforcement
(same drift risk already rejected for the mod manifest); dynamic tracing
via a one-shot recording pass (misses branches a single synthetic call
doesn't exercise); static analysis of the rule's source (needs a parser
dependency, and doesn't get you enforcement, just inference).

## Core extension: generator `paramsDefaults`

`registerGenerator(id, generatorFn)` (`mapgen.js`) declares no params
schema at all today — `mapgen-and-editor.md`'s UI sketch ("bound to
whatever schema the generator declares") predates the actual session-18
implementation, and that schema was never built. Neither the content
browser nor the map editor's params panel can introspect a generator's
tunable params without one.

**Decision**: a load-bearing `paramsDefaults` object — values only, no
explicit type/min/max/schema. `generateZone` merges declared defaults into
`params` whenever a field is omitted, so the declaration is genuinely used
at generation time, not merely descriptive (same "declaration is the
behavior" principle as the `components` filter). The UI infers control
type from each default's JS type (number → numeric input, boolean →
checkbox, string → text field) rather than needing an author-maintained
range/type schema that could go stale.

Considered and rejected: a full declared type/min/max schema (purely
descriptive, real drift risk since nothing ties it to the function's
actual behavior); static analysis of the generator function's signature
(can't recover type/range info from JS destructuring defaults, needs a
parser dependency); a full runtime validation schema like zod (load-bearing
like the chosen option, but heavier machinery than a handful of simple
numeric knobs need); free-form key/value editing with no schema at all
(simplest, but punts the "nice bound UI" question entirely).

**Migration needed in all four first-party generators.** Checked
`bsp.js`/`cellularAutomataGenerator.js` directly: today's defaults
(`minPartitionSize = 6`, `roomMargin = 1`, etc.) are buried inside the
*lower-level composable primitive* (`carveBsp`, `carveCellularAutomata`),
not the actual registered generator function (`bspGenerator`) — the
wrapper just passes `undefined` through if a param is omitted, and the
primitive's own destructuring default catches it one level down. Since the
content browser/params panel can only see registration-level data, there's
nothing to introspect for these today.

The fix is neither "duplicate the number in both places" (reintroduces
drift) nor "delete the primitive's own default" (breaks `carveBsp`'s
deliberate standalone use as a composable primitive, a real session-19
design goal — an author can call it directly without going through
`registerGenerator` at all). Instead: extract each default into one
**exported named constant** (e.g. `DEFAULT_MIN_PARTITION_SIZE`), have the
primitive's own signature default to that constant (preserving standalone
usability), and have the generator's registration-time `paramsDefaults`
reference the same imported constant — one literal value, read from two
call sites, never duplicated. Confirmed (not just presumed) against all
four generators: `bspGenerator`, `cellularAutomataGenerator`, and
`wfcGenerator` (`collapseWfc`'s `maxRetries = 50`) all migrate cleanly.

**Exception: `layeredBiomeGenerator`'s `seedCount` doesn't migrate.**
`partitionBiomes`'s buried default is `biomes.length * 2` — computed from
another param, not a static value — so it can't be lifted into an
exported constant the way the other three generators' defaults can;
`paramsDefaults` is values-only, set at registration time, before
`biomes` is known. **Decision**: leave it as a documented exception rather
than forcing a static fallback into the mechanism (which would risk
silently changing behavior for any caller currently relying on the
size-relative default) — no `paramsDefaults` entry for `seedCount`,
`partitionBiomes`'s dynamic default stays exactly as-is, and the params
panel simply shows no default for that one field, same as any
undeclared-default param today.

## Core gap, flagged but not fixed by this doc: bulk entity introspection

`ctx`/`api` only expose per-component-type access (`getComponent`/
`hasComponent`, one type at a time) — there's no `getComponentsForEntity
(id)` returning everything attached to one entity. The underlying data
trivially supports it (`world.components` is `Map<type, Map<entity,
data>>` — a cheap loop over however many types exist, checking one
`.has(entityId)` each); it's absent only because `ctx`/`api` never hand
out the raw `world` object at all (`core-architecture.md`'s "no backdoor
access to internals" rule). A content/entity browser and any real "what's
on this entity" inspector needs this — a small, natural addition to
`api.js`/`createContext`, same shape as the other bound methods. Flagged
for whichever session implements `core`-side entity/content browsing
support; not designed further here.

## The hot-reload dev harness

The shell every other tool in this doc mounts inside.

**Decision**: `@glyphrogue/core` is a `peerDependency` of `@glyphrogue/
editor`, not a regular dependency. The editor never constructs its own
`core` instance — it operates on whatever live `api`/world the consuming
game already built. A regular dependency risks two installed copies in a
downstream game if version ranges don't align; `peerDependency` matches
the actual "operates on a caller-supplied instance" relationship and
avoids the dual-instance risk.

**Decision**: `mountEditor(container, api)` attaches editor DOM into a
container element `dev.html` provides, as a sibling region to wherever the
game mounted its own canvas/UI — consistent with `rendering.md`'s existing
Canvas+DOM hybrid and `ui-and-input.md`'s "no frontend framework assumed"
stance for game code. No iframe, no overlay-over-canvas, no
editor-hosts-the-game inversion of control.

**Decision**: `packages/editor`'s own internal UI is authored in **Svelte
5**, compiled ahead of time, with only the compiled output published —
never the `.svelte` source, never a Svelte compiler dependency imposed on
whoever consumes the package. This is a different question from the
game-facing "no framework assumed" decision (`ui-and-input.md`) — that one
keeps `core`/`input` agnostic since games pick their own stack;
`packages/editor` is a single codebase fully owned by this project, never
shipped into a game, with genuinely complex stateful UI (a schema-driven
params panel, a tileset picker) that benefits from real component
authoring. Svelte compiles reactivity away entirely rather
than diffing a vdom at runtime, which is a better match for this doc's
actual UI shape than a Preact+htm alternative would be — live-tuning
surfaces (calibration sliders, a params panel reacting to every keystroke)
get direct, surgical DOM updates instead of a tree diff on every change.

**Consequence — the one package in this monorepo with a real build
step.** Every other package (`core`, `input`, `cli`) ships raw `src/`, no
build step, `package.json` `exports` pointing straight at source
(session 14's decision). `packages/editor` deliberately breaks that
pattern: `svelte` and `@sveltejs/vite-plugin-svelte` are *devDependencies*
only, never installed by a consuming project; `exports` points at a
compiled `dist/` instead of `src/`; `dist/` is gitignored and regenerated
by a `build` script wired to `prepublishOnly` so a publish can't happen
against stale output. What a downstream game actually imports is still
plain, dependency-light compiled ESM — no unbundled framework runtime to
install, arguably closer to "raw importable source" than Preact+htm's own
runtime dependency would have been. `packages/editor`'s own contributor
inner loop (editing the editor's UI itself, a different question from the
hot-reload-a-consuming-game's-world-state harness decision below) runs
`.svelte` source directly through Vite's Svelte plugin with real
component-level HMR.

**Decision**: hot-reload state preservation reuses `packages/core/src/
save.js`'s existing `serialize`/`deserialize` plus `storage.js`'s
`createLocalStorageBackend`, snapshotting the live world on `import.meta.
hot.dispose` and restoring it after the reload — rather than building real
`import.meta.hot.accept()` state-preservation machinery (a materially
bigger, more novel mechanism with real edge-case risk around in-flight
async turns). No new mechanism: this wires an existing, already-tested one
to a new trigger point.

**Decision**: custom screens (`registerScreen`) are fully decoupled from
any of the above. `packages/core/src/screen.js` is a thin registry
wrapper with zero rendering logic — the `render` callback is arbitrary
author-supplied code, per `custom-ui-and-interactions.md`'s "how it
integrates with whatever DOM/framework choice a game makes." A game
author's own custom-screen framework choice (React, Vue, whatever) is
completely independent of what `packages/editor` picks for its own UI.

## Shared file-write API

The dev-server-side infrastructure nearly every feature in this doc
routes through — map editor overrides, tileset calibration, config UI,
scaffold generation, the touched-files log's provenance, plugin
management. A Vite plugin adding server-side middleware the browser-side
editor calls into, since a browser tab can't touch the filesystem
directly.

**Decision: whole-file operations only, never partial/surgical edits of
existing files.** Anything that sounds like "edit an existing file in
place" (e.g. wiring a newly-scaffolded entity into a plugin's index, or a
bootstrap file's register-call list) is handled one of two ways instead: a
file the tool needs to "own" entirely (an auto-generated index) is fully
regenerated from a directory scan every time, never hand-edited; anything
needing a human decision becomes a one-line instruction surfaced to the
author (e.g. "add `import './goblin.js'` here") rather than the tool
silently rewriting a file it doesn't fully control. This avoids needing a
fragile marker-comment convention or a real AST parser (a new dependency,
still fragile against the author's own formatting/reordering), and never
risks corrupting hand-written code.

**Decision**: reuses `packages/core/src/storage.js`'s `createFsStorage`
for the actual write mechanics — atomic temp-file-then-rename, already
built, already tested. The plugin's write endpoint calls this directly
rather than reinventing file-writing logic.

**Request shape** carries the write and its provenance label together:
`{ path, content, tool, label }` — one round-trip serves both the write
itself and the touched-files log's per-path annotation.

A basic path-containment check applies to the resolved path, even though
this is a local, dev-only server never shipped (same trust model as
Vite's own HMR channel) — cheap hygiene, not a real threat-model response.

**Read/query side is needed too, not just writes** — checking file
existence before create-vs-overwrite, and the touched-files log's
git-status-driven view (below), both need the same server-side plugin to
expose a read/query path (git status via `child_process`, or a directory
scan) — only server-side code can reach git/the filesystem.

## Touched-files log

**Decision**: derived from live git/filesystem state, not an
independently-maintained ledger — same "derive, don't hand-maintain"
reasoning already established for the mod manifest (`scripting-api.md`)
and the `components` filter above. A self-maintained log can drift from
reality (the author deletes a file outside the editor, or a git operation
reverts it) in a way a live query can't. The file-write API additionally
attaches a small provenance annotation per path — which tool touched it, a
human-readable label ("scaffolded new entity: Goblin") — purely as
decoration on top of what git/filesystem already independently confirms
exists. If a labeled file disappears outside the editor, it just stops
showing up; no stale entries, no separate source of truth to keep in
sync. Scoped to "help find/relocate what just got touched," not a full
historical audit trail of every past action including later-reverted ones.

## Shared live-preview rendering primitive

Four concrete consumers identified in this doc alone — calibration
tuning (glyph alignment preview), symbol/tileset authoring (assembled-tile
preview), palette editing (color/gradient preview), and the map editor
(zone preview) — all needing the exact same thing: draw glyphs/data via
`packages/core/src/glyphRenderer.js`'s existing `drawGlyphCell`/
`drawTileCell` functions, fed with whatever tentative, not-yet-saved data
the active tool is tuning.

**Decision**: build this as one shared "live preview surface" piece of
harness infrastructure, a thin wrapper around the existing render
functions, rather than four independent implementations. This meets the
bar this doc otherwise holds everything to (generalize only once 2+ real,
identically-shaped needs exist) — unlike the schema-driven form primitive
below, where the needs turned out *not* to be identically shaped despite
superficially resembling each other.

## Narrow shared form primitive

A broader "schema-driven form" primitive was considered for every
control-bound-to-a-schema UI in this doc (map editor params, tileset
calibration sliders, config UI's three panels) — five candidate
consumers by the end of the survey. Counting consumers isn't sufficient
on its own, though; their actual shapes have to match too.

Checked each: **map editor params** (`paramsDefaults`) and **audio
mixing** (three 0-1 sliders) are genuinely the same shape — flat `{ key:
defaultValue }`, control type cleanly inferred from the default's JS
type. **Tileset calibration**'s `horizontalCenteringMode` is a fixed enum
a JS-type inference can't produce (a string default doesn't reveal the
valid option set). **Keybinding**'s panel is a variable-length
array-per-action plus a genuinely special capture interaction, not one
control per field. **Palette**'s tokens are recursively-structured (a
token is a color *or* a gradient with nested stops, each possibly
referencing another token). The latter three have real structural
differences a single generic form would either mishandle or need a
special case for — the same premature-generalization risk this project
avoids elsewhere, just showing up on the "how many consumers" axis
instead of the "speculative up-front design" axis.

**Decision**: generalize only the narrow flat-defaults case — map editor
params and audio mixing share one primitive. Keybinding, palette, and
tileset calibration stay individually-built.

## Map editor

**Scope correction**: "static edit mode vs. playtest mode"
(`core-architecture.md`) is not map-editor-specific — it belongs at the
harness level. Static edit mode (scheduler paused) is just what map
editing already is; no separate toggle is needed within the tool itself.
Playtest mode (real scheduler, continuous/single-step) is a property of
the whole dev environment ("is the actual game currently running"),
governed by harness-level Edit/Playtest chrome that the map editor is
simply one tool available under.

**Decision: both in-context editing and standalone zone/template
authoring are in scope**, and both share the exact same `api` instance the
harness already holds — no second/sandboxed `core` instance needed for
either, since `generateZone`/`stampTemplate`/etc. only need a registry and
a zone id, not a "live game." The two flows differ only in *which zone id*
is being operated on and *what happens to the output*, never in what
mechanism produces it.

- **In-context editing** — operates on the live world's actual current
  zone (harness-level edit/playtest toggle handles pausing). Hand-edit
  cells/entities, or reroll/regenerate, directly against that real zone.
  These edits are, by default, ordinary ephemeral live-session state,
  already covered by the harness's existing save/load-based hot-reload
  snapshot — nothing new needed there. They only become permanent project
  content when the author explicitly exports them as an **override**
  (`zoneDiff.js`'s existing diff/overlay mechanism — the same one
  player-mutation saves reuse) via the shared file-write API.
- **Standalone authoring** — generate/tune against a scratch zone id that
  never touches the live world, held only in the editor's own UI state
  until exported. Live preview reuses the same rendering layer, pointed
  at the scratch `ZoneDTO` instead of live-world data. Two distinct export
  shapes: a **template fragment** (`ZoneDTO` slice with declared
  connection points, for stamping later), or a **seed+params preset**
  (`{ generatorId, seed, params }` — a reusable curated-seed artifact,
  matching `mapgen-and-editor.md`'s own seed-sharing goal).

**Throughline**: nothing persists automatically. The author's live
experimentation stays ephemeral until an explicit export/save action turns
it into real project content via the file-write API — the same pattern as
config UI, scaffold generation, and everything else in this doc.

**Pin/lock selection mechanics**: a rectangular marquee-drag on the
preview canvas (mousedown/drag/mouseup), converted to cell coordinates via
`camera.js`'s existing `screenToWorld` — no new coordinate mechanism
needed. "Pin" itself needs no change to `generateZone`/`GenerationContext`
at all — purely editor-side: snapshot the pinned region's current cell
data *and* any entity placements within those bounds (not just terrain, or
a stamped object in a "locked" area could vanish on reroll even though the
ground didn't change) before rerolling, call `generateZone` completely
fresh, then patch the snapshot back into the new result before rendering.

**Panel layout**: `mapgen-and-editor.md`'s original two-pane sketch
(params/seed panel + live preview) still holds, now using the shared
live-preview primitive and the `paramsDefaults`-driven params panel. Both
in-context and standalone authoring share this same layout rather than
separate screens — distinguished only by a mode indicator ("editing zone
X" vs. "authoring scratch template") and whichever export action applies.

**File conventions**: `build-pipeline.md`'s existing
`create-glyphrogue-game` scaffold already names `src/maps/` as the content
folder. Templates, presets, and overrides each get their own sub-folder —
`src/maps/templates/`, `src/maps/presets/`, `src/maps/overrides/
<zoneId>.json` — one override file per zone id, since nothing has
demonstrated a need for multiple simultaneous overrides per zone. All
three are plain `.json`, not `.js` modules, even though `build-pipeline.md`
allows either for authored content generally: all three are plain
serializable data (`ZoneDTO`, `{generatorId, seed, params}`,
`{cellOverrides, entityDiffs}`) with no actual logic, and JSON is simpler
for the file-write API's write mechanics (a direct `JSON.stringify`, no
need to also emit valid module syntax) and easier to hand-inspect in
version control. Worth revisiting toward `.js` if a future need arises for
authored logic alongside this data (e.g. a template wanting a
computed/conditional shape).

## Content browser

**Base data source is `recordingApi.js`'s existing manifest** — a flat
list, `{ kind, id, ...summary }`, in call order, covering everything
registered via `register*` (rules, generators, entity/entity-types,
screens, sounds, scripted events, plugins). No new `core` mechanism needed
for the raw list itself — already built (session 25).

The valuable part is derived cross-references built on top of that flat
list, not the raw listing. Since `registerRule`'s `components` filter and
entity-type component lists are both real declared data now, the browser
can compute real indexes: component → every rule that filters on it
(delivers "inspect a component, see its rules"), and entity type → every
rule that would match its instances (cross-referencing an entity type's
declared components against every rule's filter). Both directions are
genuinely computable from static registration data, not just listable.

**Decision: two distinct kinds of browsing, treated as separate views, not
conflated.** Static/registry browsing (what's been registered, derived
from the manifest — no running game needed) and live/world browsing (what
entities actually exist right now and what components they currently
carry — needs a live `api`/world, and directly depends on the
`getComponentsForEntity` gap above getting filled).

**Decision: facet-able list, not a fixed hierarchy or separate
index-browsing UI.** The static/registry view is a search/filter bar over
a `kind`-grouped list (rules, generators, entity types, screens, sounds,
scripted events, plugins) by default. The two computed cross-reference
indexes above aren't a separate feature — they're alternate *entry
points* into the same list: selecting a component or entity type from a
detail panel re-filters the list to "everything referencing this," rather
than the browser needing its own index-specific views. The live/world
view mirrors this — an entity list filterable by the same
type/component facets, querying the live world (`ctx.query`/
`getComponentsForEntity`) instead of the manifest; selecting an entity
shows its full live component set.

**Decision: a deliberate cross-navigation shortcut between the two
views, without conflating their data sources.** Selecting an entity
*type* in the static view offers a "show live instances of this" jump
into the live view. This stays consistent with "two distinct kinds of
browsing, treated as separate views" above — it's a navigation shortcut
between two independently-sourced views, not a merged data model.

Exact panel/detail-pane visual layout is still left to implementation
time — the data model, filtering shape, and cross-navigation affordance
above are now settled.

## Composition wizard

**Decision: not a standalone mechanism — a second UI surface over the
same catalog the content browser needs.** "Smart" composition means
cross-referencing what the author wants against already-registered
reusable behaviors (first-party and project-local), which requires the
exact same introspection data the content browser is built on. The wizard
doesn't need its own separate knowledge source.

**Concrete payoff from the `components` filter**: since a behavior's rule
now declares its applicability (e.g. `Wanders`'s rule is effectively
`{ all: ['Wanders'] }`), the wizard can mechanically answer "if I add
component X to this entity, which existing rules start applying?" by
reading the declared filter — no need to understand what the rule's
function body actually does.

Two genuinely different scaffold cases:

- **Attaching an existing behavior** (e.g. "make this entity wander") — no
  new rule needed. The wizard adds the marker component (e.g. `Wanders:
  {}`) to the entity's component list; the already-registered global rule
  picks it up automatically via its own filter. If that rule isn't
  registered anywhere in the project's bootstrap yet, the wizard surfaces
  the needed import/register line as an instruction for the author to add
  themselves (consistent with the file-write API's whole-file-only rule —
  a game's bootstrap file is hand-authored, not a tool-owned file the
  wizard should silently rewrite) — never writes new logic either way.
- **Genuinely custom behavior** — the wizard generates a properly-shaped
  stub (`registerRule`/`registerEntityType` call, a `components` filter
  pre-populated from the entity's other declared components, TODO
  function body) for the author to fill in themselves, in their own
  editor. The wizard never writes actual game logic — consistent with the
  companion framing.

**Real design choice surfaced to the author for the custom case**: should
the new rule be entity-type-scoped (`registerEntityType`'s inline `rules`,
auto-limited to this one type) or standalone/globally reusable (a plain
`registerRule` call with an explicit filter, so other entity types could
opt in later, same shape `Wanders` already uses across multiple types)?
This mirrors a real existing architectural distinction rather than
inventing a new one.

Scaffold generation is a natural extension of `packages/cli`'s existing
"generate files from a template" job (`build-pipeline.md`) — likely shares
generation logic with `cli`, with editor's GUI as a front-end over it, not
a separate implementation.

## Tileset/font-calibration editor

**Decision: two sub-tools under one umbrella, not one UI** — same pattern
as config UI's own internal split, different granularity and interaction
model for each:

- **Font-source calibration tuning** — per font source (`fontSources.js`),
  adjusting `scale`/`baselineOffset`/`horizontalCenteringMode` via sliders
  plus live visual feedback (the shared live-preview primitive) until
  glyphs render aligned in the grid.
- **Symbol/tileset authoring** — per symbol (`tileset.js`'s
  `registerSymbol` `{ fontFace, codepoint, foreground, background }`), a
  picker/table workflow: pick font source, pick glyph, assign colors
  (referencing palette tokens — connects to config UI's palette panel).

Two wrinkles specific to symbol authoring: the glyph picker's data source
differs by font type — a Pixelyph-imported source has a real manifest
(`{meta, glyphs}`, keyed by hex codepoint) to browse directly; a plain
system/monospace fallback has no such manifest, so picking a codepoint
there is more like selecting from standard Unicode ranges than browsing a
curated list. And calibration is relative to one pinned **reference** font
source (`createFontSourceRegistry({ reference? })`) — the UI needs to make
clear which source currently *is* the reference (not meaningfully
editable relative to itself), and changing the reference is a real,
semi-destructive action (recalculates every other source's derived
defaults) deserving a clear confirmation step, not a casual toggle.

**Decision: two tabs, mirroring the content browser's own layout
pattern.** Calibration tuning: a font-source selector (the reference
source visibly badged, not left implicit) + the `scale`/`baselineOffset`/
`horizontalCenteringMode` sliders + the shared live-preview primitive
rendering a calibration grid that updates live as sliders move. Symbol
authoring: a searchable/filterable table of registered symbols (id, font
source, codepoint, glyph preview swatch) — the same list-plus-detail-panel
shape the content browser settled on — with an editor form per symbol
(font source picker, glyph picker, palette-token color pickers), also
reusing the live-preview primitive to render the assembled tile
(`drawTileCell`), not just the calibration grid.

**Decision: reference-source change confirmation is a plain modal
warning**, naming how many other sources' derived defaults will get
recalculated — not a full diff/preview of the actual numeric changes.
Simplest thing that still stops an accidental click on a semi-destructive
action.

**Decision: the non-manifest glyph picker combines raw input with
presets, not one or the other.** Raw hex/codepoint text input always
works and needs no maintenance; on its own, though, it's not really
"browsable" if the author doesn't already know the codepoint they want. A
small set of common Unicode block-range quick-jump presets (Latin-1, Box
Drawing, etc.) sits on top of raw input as a discovery aid, not a
replacement for it.

## Config UI

**Decision: splits into two categories by underlying mechanism, but both
resolve to the same persistence path.**

- **Palette editing is author-facing content, not a runtime settings
  slice.** `palette.js` has no `save`/`load` anywhere — a palette is just
  game-authored data (`{tokens: {...}}`), imported like any other source
  per `build-pipeline.md`'s "maps/data files are code, not assets"
  decision. Editing it is editing project data, full stop — routes
  through the file-write API (whole-file overwrite), no storage backend
  involved.
- **Keybindings and audio mixing are genuinely player-facing runtime
  settings** (`keybindingStorage.js`, `audioSettings.js`, both real
  `storage.js`-backed slices meant for a player to adjust in a shipped
  game) — but the editor's job is tuning *defaults*. Flow: preview/test
  live using the same runtime mechanism a player would (so it feels
  right), then write the chosen values back into the game's own
  default-settings source via the file-write API — dev-time local storage
  alone never ships, so it can't be the actual persistence path.

**Unifying rule**: regardless of whether the underlying thing is content
(palette) or player settings (keybindings, audio), the editor's own
persistence path is always "tune it live, then write the result to
project source via the file-write API." The runtime storage mechanism is
for the player later, never what the author's own tuning session should
depend on.

**Keybind capture reuses the existing exclusive capture stack**
(`packages/input/src/captureStack.js`) rather than a bespoke raw-listener
— the "listening for your next keypress" UI pushes its own entry onto the
same stack any other topmost UI surface uses.

**Neither input actions nor palette tokens are a registered concept** —
unlike rules/generators/entities (`registry.js`-backed, browsable via
`recordingApi.js`'s manifest), a keymap's input-action ids and a palette's
token names are plain object keys in whatever the game's source defines.
Config UI can't reuse the content-browser's manifest approach for "what's
the vocabulary here" — it has to read the actual keymap/palette object
directly.

**Panel layout: three tabs — Palette / Keybindings / Audio** — matching
the three-way mechanism split above (this section otherwise had no
described layout at all, unlike every other tool in this doc).

- **Palette tab**: a token list, accounting for the recursive structure (a
  token is a color or a gradient with nested stops, each possibly
  referencing another token), each with a live-preview swatch via the
  shared live-preview primitive. Edits write back to the palette source
  file (whole-file overwrite via the file-write API).
- **Keybindings tab**: an input-action list, each showing its current
  binding(s) (variable-length, array-per-action) plus the "capture next
  key" affordance (the exclusive capture stack). Writes to the game's
  default-settings source.
- **Audio tab**: the three 0-1 sliders, via the narrow shared form
  primitive already decided for exactly this shape. "Preview live" means
  actually hearing the mix while adjusting, using the same runtime
  playback mechanism a player would get. Writes to the default-settings
  source.

## Plugin management

**Decision: discovery/enabled-state is derived, not hand-maintained** —
same "derive, don't hand-maintain" posture as the mod/plugin manifest, the
`components` filter, and the touched-files log elsewhere in this doc.
Discovery has **two sources, not one**: the tool scans `src/plugins/` (the
CLI scaffold's content folder, per `build-pipeline.md`) for author-authored
candidate plugin modules, and separately recognizes `@glyphrogue/core`
imports in the bootstrap file as core-bundled plugins (`scripting-api.md`'s
Content plugins shipped with the engine itself — the four first-party
generators, four first-party behaviors; see `mapgen-and-editor.md`). Both
sources cross-reference against whatever the bootstrap file's
`loadPlugins(api, [...])` array actually lists to derive enabled-vs-
available — no separately tracked enabled flag to drift out of sync. The
two sources render as one combined list but stay visually distinguishable:
only author-authored entries have a `src/plugins/` folder to toggle,
import, or export — a core-bundled entry's toggle just adds/removes its
import and array entry, nothing more.

**Decision: a per-plugin enable/disable toggle**, not a toggle-plus-manual-
reorder list. Toggling adds/removes the plugin's import and array entry in
the bootstrap file via the file-write API's existing "surface a one-line
instruction rather than silently rewrite a file the tool doesn't fully
own" pattern (same as scaffold generation elsewhere in this doc). Manual
reordering is deliberately not a feature — `loadPlugins`'s dependency-based
topological sort already resolves load order, so a manual order control
wouldn't do anything. `plugins.js`'s existing dependency-cycle/version-
mismatch errors surface as UI feedback here instead of a console throw.

**Decision: a plugin is a self-contained folder, `src/plugins/<pluginId>/`
— an entry module plus any assets it needs** — not a loose single `.js`
file. This is what makes import/export (below) a plain filesystem
operation rather than needing a real bundler/packaging step, and is
worth establishing now, before a large body of existing plugins exists to
migrate later. Applies to author-authored plugins only — a core-bundled
plugin has no folder in the downstream game's own repo at all.

**Decision: import/export for author-to-author plugin sharing.** Import
copies a plugin folder an author received into `src/plugins/` via the
file-write API, then surfaces the same one-line "wire it into your
bootstrap" instruction scaffold generation already uses. Export packages
a plugin's own folder (plain filesystem copy/zip, not a real package/npm
artifact) for handing to another author — matches this project's
low-ceremony bias, no new packaging machinery needed. Both are strictly
dev-time, author-to-author sharing — distinct from, and no substitute
for, actual end-user mod distribution (`scripting-api.md`'s "Scope
boundary" section, still out of scope everywhere). Neither applies to a
core-bundled plugin: there's nothing on disk in the game's own repo to
export, and "importing" one just means adding the existing `@glyphrogue/
core` import to the bootstrap, indistinguishable from an ordinary toggle.

### Services

Service plugins (`scripting-api.md`'s "Plugin kinds: Content vs. Service")
get a distinct section here, not folded into the content list above — a
service is single-slot, so per-item enable/disable doesn't apply the same
way: two services can't both fill the same slot at once.

**Decision: a per-slot selector, not a toggle list.** For each known
service slot (`memory`, `audioLoader`), the Services section shows which
plugin currently fills it — core-bundled, an author's own override, or
none — with a control to switch to a different available implementation or
turn the slot off entirely (the game simply runs without it, e.g. no
remembered-tile persistence). Switching writes the same kind of bootstrap
edit content's toggle does — add/remove an import and array entry, with
`id`/`override` set correctly for a swap — through the same file-write API.

Discovery for the selector's option list follows the same two-source,
derived posture as content above: core-bundled service plugins shipped
from `@glyphrogue/core`, plus any author-authored override candidates
found in `src/plugins/`, cross-referenced against the bootstrap array to
determine which one (if any) is currently active for each slot.

## Open items carried forward

- **Player-facing Mod management** — deliberately out of scope for this
  doc (see "Plugin vs. Mod" above); genuinely new `core`-level work
  (a persisted, player-toggleable enabled-mods settings slice) with no
  session scoped for it yet.

## Implementation sequencing

See `BACKLOG.md`'s "packages/editor design roadmap" for the proposed
session order. Summary: a `core`-only mechanisms session first (both
extensions above, `getComponentsForEntity`, plus the `mods.js` → Plugin
rename pulled forward from "Open items carried forward"), then the
harness, then plugin management (its only real dependencies are the
rename and the harness's file-write API, not the shared UI primitives —
sequenced independently of them rather than grouped in), then shared UI
infrastructure (live-preview + narrow form primitives), then the
individual tools in dependency order (map editor, content browser,
composition wizard, tileset/calibration editor, config UI).

Plugin management additionally now depends on `BACKLOG.md`'s "packages/core
plugin reconciliation roadmap" being done first — the generators/behaviors/
memory/audioLoader Content and Service plugins this section's discovery and
Services selector operate on don't exist as real plugins until that
reconciliation lands.
