# Scripting & content/plugin API

Deep-dive design doc for `core`'s plugin API — the surface a game's own
first-party content, and later end-user mods, register entities, rules,
generators, and scripted events through. Produced in the session-5 planning
pass (see `BACKLOG.md` for the roadmap this fits into). Treat this as the
source of truth for the topics below — `DESIGN.md` will be trimmed to a
short summary linking here.

This doc defines the **authoring/registration contract**. It does not cover
how an end-user mod is discovered, installed, or distributed — that's
scoped to the packaging session (topic 8); see "Scope boundary" at the end.

## Plugin module format

A plugin module — first-party or (later) end-user-authored — is a single
default export: a descriptor object, not a function or a set of named
exports.

```js
export default {
  id: 'goblin-pack',
  version: '1.0.0',
  dependencies: { core: '^0.5.0', 'base-bestiary': '^1.2.0' },
  register(api) { /* ... */ },
}
```

**Why one entry point, not named exports per content type**: the loading
*mechanism* differs between first-party content (statically imported at
build time) and end-user-authored plugins (loaded at runtime, once that's
built out — see "Scope boundary"), but the module *contract* plugin authors
write against should not. A single `register(api)` call, using the same
public inspection/mutation API `core-architecture.md` already defined as
the one surface every consumer (game runtime, editor, plugins) goes
through, works identically regardless of how the module was loaded. Named
exports per content type were considered and rejected: every new content
type added later would be a new export name every loader has to know
about, and function-shaped registrations (generators, rules) don't fit a
"plain data export" pattern anyway.

**No hand-authored manifest.** A descriptor listing "what this plugin
contains" would drift from what `register()` actually does. Instead, a
manifest is *derived*: dev tooling (the editor's content browser, a
load-time validator) calls `register()` with a **recording** implementation
of the same public api — one that logs each registration instead of
mutating real state — and produces the manifest from that. Zero drift risk,
no second surface for plugin authors to maintain, and the recording api is
a core/editor-side dev tool, not something a plugin author ever writes to
directly. It also gives a natural place for load-time validation (duplicate
ids, `register()` throwing) before a plugin runs against the real api.

## Data-driven definitions vs. behavior

**Definitions are inert data.** `registerEntity` (and the `registerEntityType`
sugar below) describe what an entity starts with — its components,
including zero-data "marker" components used purely as behavior tags
(`ExplodesOnDeath`, `Flammable`). Items and creatures are not a separate
mechanism; they're entity definitions with a particular component set.

**Behavior is a rule**, reusing `core-architecture.md`'s action/rule model
directly rather than inventing a second one. A rule is keyed to the
**action type** it reacts to, and queries components to decide whether it
applies — it is not keyed to a specific entity id:

```js
api.registerRule('goblin-explode-on-death', 'Death', (action, ctx) => {
  if (!ctx.hasComponent(action.entity, 'ExplodesOnDeath')) return;
  return { followOn: [{ type: 'Explosion', at: ctx.getComponent(action.entity, 'Position') }] };
});
```

This means a plugin adding "goblins explode on death" never touches core's
own `Attack` → `Damage` → `Death` chain — it adds one more rule downstream
of `Death` that checks for a component. Matching on components rather than
hardcoded ids keeps this composable: the same rule applies to any future
entity tagged `ExplodesOnDeath`, not just goblins specifically.

**Multiple rules per action type run as an ordered pipeline**, not
single-owner. Each applicable rule can veto legality and/or emit follow-on
actions. This is what lets a plugin layer in reactive behavior
(explode-on-death, poison-on-hit) without overriding or replacing core's
own rules for the same action type — it extends `core-architecture.md`'s
own chaining example ("an Attack rule validates range, emits Damage,
possibly Death") one link further down the chain.

### `registerEntityType`: bundling a definition with its own rules

Rules that belong to one definition are common enough to warrant sugar over
the two primitives above — not a new runtime concept, just a unified
authoring surface that decomposes into one `registerEntity` call plus N
`registerRule` calls internally:

```js
api.registerEntityType('goblin', {
  components: { Position: {}, Health: {current: 5, max: 5}, ExplodesOnDeath: {} },
  rules: [
    { action: 'Death', handler: (action, ctx) => ({ followOn: [{ type: 'Explosion', at: ctx.getComponent(action.entity, 'Position') }] }) },
    { action: 'Attack', handler: (action, ctx) => { /* ... */ } },
  ],
});
```

Rules declared inline are automatically scoped to this definition's
entities (core injects the match condition), so the common "this rule only
applies to this entity type" case doesn't need a hand-written component
check. The recording-api manifest also gets this grouping for free — one
registration call, so "goblin: 2 rules" is derivable without extra
bookkeeping.

**Standalone `registerRule` remains available and is the right tool for
genuinely cross-cutting rules** that aren't owned by one definition — e.g.
"anything with `Flammable` ignites near lava." Both forms feed the same
per-action-type pipeline; ordering and legality semantics don't fork based
on how a rule was registered.

## Event/hook system

There is no separate event/hook mechanism alongside rules — that would be
two competing ways to react to the same state changes. "Hooks" in this
design *are* rules registered against action types, as above. The only
things that warrant a distinct, small **lifecycle hook** concept are things
that aren't in-game actions at all: plugin loaded, save loading/migrating.
These are out of scope for this doc beyond flagging that they exist as a
separate, much smaller mechanism from the rule pipeline.

### Scripted events

`core-architecture.md` already named "a scripted-event trigger" as an
example action, and flagged playtest mode's single-step control as existing
specifically to step through scripted events. This confirms scripted events
are not a new primitive — they slot into the same action/rule pipeline:

- **Trigger**: something emits a triggering action — player enters a map
  region (reusing `mapgen-and-editor.md`'s stamp/anchor mechanism for
  trigger zones), an item pickup, a dialogue choice, another rule's
  follow-on.
- **Simple events**: a rule matches the trigger and returns multiple
  follow-on actions synchronously (spawn creatures, show dialogue, lock a
  door) — the same `followOn: [...]` array as above, just more entries.
- **Multi-step events spanning turns**: progress lives in an `EventState`
  component (`{ step: 2 }`) on an entity, same as any other persistent
  state. The next trigger's rule reads and advances it. This means event
  progress saves/loads for free via the existing DTO mechanism, and
  playtest single-stepping works for free too — it's just actions moving
  through the same scheduler one at a time, no special debugger case
  needed.

**`registerScriptedEvent`: declarative sugar for the multi-step case only.**
Simple, single-trigger reactions stay plain `registerRule` calls. Multi-step
sequences get a step-list format that compiles down to the `EventState` +
rule mechanism above, rather than requiring hand-written state-machine code
for every scripted narrative beat:

```js
api.registerScriptedEvent('goblin-ambush', {
  trigger: { action: 'EnterRegion', region: 'goblin-camp' },
  steps: [
    { do: [{ type: 'SpawnEntity', entityType: 'goblin', count: 3 }, { type: 'ShowDialogue', text: '...' }] },
    { waitFor: { action: 'DefeatAll', entityType: 'goblin' } },
    { do: [{ type: 'UnlockDoor', doorId: 'camp-gate' }] },
  ],
});
```

`waitFor` supports two forms:

- **Wait for an action**: `{ action, ...matchFields }` — simple
  field-equality matching for common cases, with an escape hatch to a JS
  predicate function for anything complex, rather than building a full
  query language.
- **Wait for elapsed time-units**: `{ timeUnits: 30 }` — resolves through
  the *same* "wait for a specific action" mechanism as the action form,
  rather than adding a second timing concept. A time-based wait schedules a
  lightweight timer entity into the same time-units scheduler
  `core-architecture.md` already designed (rot.js-style `Scheduler`/
  `Engine`); when the timer's turn comes up it emits a synthetic
  `EventTimerElapsed` action that the event's rule matches. Since
  scheduler/time-units state is already part of `core`'s DTO save slice, a
  pending timed wait persists and resumes correctly with no extra work.

**Deferred to implementation time** (matching how other docs handled
algorithm-scale specifics): branching step lists (v1 is linear only; a step
needing to branch drops to a plain JS rule instead of the sugar), and
event interruption/cancellation (player leaves mid-event).

## Registering systems, rules, and generators through one mechanism

All registration calls on `api` share one shape: `id` first, then
content-specific arguments, then an optional trailing `options` object —
matching `registerGenerator(id, generatorFn)`'s existing shape from
`mapgen-and-editor.md` rather than introducing a second convention:

```js
api.registerEntity(id, def, options?)
api.registerEntityType(id, def, options?)
api.registerRule(id, actionType, ruleFn, options?)
api.registerGenerator(id, generatorFn, options?)
api.registerScriptedEvent(id, def, options?)
```

### Conflict handling

- No `options.override`, id already taken → **hard error at load time**.
- `options.override` must **exactly match the `id` being registered** — a
  self-referential confirmation, not a `true` flag. This is deliberately
  redundant: copying a registration block and forgetting to update
  `override` after changing `id` produces a mismatch, which is itself an
  error, catching the exact copy-paste mistake this guards against.
- `override` matches `id` and something is already registered under that
  id → last-registered-wins, this one replaces it.
- `override` matches `id` but **nothing** is registered under that id yet
  → also an error (overriding something that doesn't exist usually means a
  missing dependency or bad load order).

### Load order: dependency graph, not declaration order

"Last-registered-wins" only means anything if load order is deterministic.
Each plugin declares its dependencies (including on `core` itself — see
"Versioning & compatibility"), and load order is derived by **topologically
sorting the dependency graph** — dependencies load before dependents — not
by declaration-list order or filesystem enumeration order (which varies by
platform).

This also closes a gap in the override design: a plugin overriding another
plugin's registration must declare that plugin as a dependency, guaranteeing
load order — otherwise "overriding something not registered yet" is already
an error per the rule above. The dependency graph and the override
mechanism reinforce each other rather than needing to be kept in sync by
hand.

Two failure modes are hard errors at load time, same as everything else
here: a **dependency cycle** (no valid order exists), and a **missing
dependency** (declared plugin isn't present/enabled).

## Save-data integration

Builds directly on `core-architecture.md`'s `coreSchemaVersion`/`core` vs.
`gameDataVersion`/`game` split, extended for multiple plugins:

- **`game` payload + `gameDataVersion`** — one slice, one migration chain,
  owned by the game. Everything registered by **statically-imported
  (build-time) modules** writes here — this covers all first-party content,
  regardless of how many separate `register()` files the game's own
  codebase is organized into internally. The static-vs-dynamic import
  distinction from "Plugin module format" *is* the save-versioning
  boundary; no separate "is this first-party?" flag is needed.
- **Per-plugin slices** — `plugins: { [pluginId]: { pluginDataVersion,
  payload } }`, each independently versioned with its own migration chain,
  for anything registered by a **dynamically-loaded (runtime) plugin**. A
  plugin ships, updates, or is removed without touching the game's own
  version or migrations.

**A save requires its full plugin set to load.** If a save contains a slice
for a plugin that isn't currently installed, the game **fails to load**
rather than silently dropping or dormant-carrying that data — consistent
with every other ambiguous-state question in this doc being resolved as an
explicit, actionable error rather than an implicit best-effort behavior
(Factorio uses the same model: a save with mods refuses to load without
them present, with a clear missing-mods message). This applies specifically
to a plugin being **absent**; a plugin that's present at a different,
compatible version is handled by that plugin's own migration chain, not
this failure mode.

## Versioning & compatibility

`core` gets **two independent version numbers**, not one, since the save
DTO shape and the plugin registration API surface change on different
axes:

- **`coreSchemaVersion`** — governs the save DTO shape and migrations (from
  `core-architecture.md`).
- **An API version** (plugins check compatibility against this for
  `registerEntity`/`registerRule`/etc.'s signatures and behavior) —
  independent of the save schema; the plugin surface can change without a
  save-format change and vice versa.

`core` is declared in a plugin's `dependencies` map like any other
dependency, using the API version:

```js
dependencies: { core: '^0.5.0', 'base-bestiary': '^1.2.0' }
```

Version ranges use standard semver syntax (npm-style `^`/`~`/exact) for
both core and plugin-to-plugin dependencies — no custom compatibility
scheme.

## Sandboxing / trust boundary

**v1: no sandboxing**, for first-party content and end-user mods alike —
carried forward from `DESIGN.md` as-is, not deferred quietly but explicitly
decided here: real sandboxing (running mods in a Worker/sandboxed iframe,
communicating through the same `api` via message-passing) is a real
architectural piece with real cost (message-passing overhead on what can be
a hot path, non-trivial implementation), and this project isn't shipping
end-user mod support yet regardless (see "Scope boundary"). Treat sandboxed
execution as a **prerequisite to actually shipping end-user mod support**
later, not something this session needs to fully design now — matching how
other docs deferred implementation-scale pieces without blocking on them.

**The risk is not uniform across platforms**, and the doc should be
explicit about this rather than stating "no sandboxing" flatly: on a **web
build**, an unsandboxed mod still runs inside the browser's own tab
sandbox — no arbitrary filesystem or native access, cross-origin
restrictions still apply. On an **Electron build**, a mod has much broader
system access unless the author has separately hardened
`nodeIntegration`/`contextIsolation` (a packaging-session concern, not
designed here). This is why the mitigation below matters more for Electron
specifically.

**Mitigation: authors can disable modding, structurally, per platform.**
This reuses `DESIGN.md`'s existing dev/prod split pattern — dev-only
tooling (the editor) is kept out of production builds by the production
entry point simply never importing it, not by a runtime flag a bundler has
to tree-shake around. The same mechanism applies here: an author disabling
modding on a given platform build (Electron, say) means that platform's
build entry point never imports or wires up the end-user-mod loader at
all — genuinely absent from the bundle, not "loaded but inert." Disabling
modding globally is the same mechanism applied to every entry point. No
separate runtime `modding.enabled` flag — one mechanism, matching existing
precedent, rather than two ways to achieve the same thing. Actually
constructing these platform-specific entry points is build-pipeline-session
(topic 7) work; this doc only establishes that the mechanism is structural
exclusion, not a flag.

## Scope boundary: first-party vs. end-user mod distribution

This doc defines the **authoring/registration contract** — module shape,
definitions, rules, generators, save-slice ownership, dependency/versioning,
sandboxing posture — used identically by first-party content and (later)
end-user mods.

**Explicitly out of scope here, deferred to the packaging session** (topic
8): how an end-user mod is discovered and installed (local folder, pasted
URL, Steam Workshop-style browser, or otherwise), how the runtime
`import()` actually resolves a distributed mod's code, any UI for
enabling/disabling/reordering installed mods, and update-checking for
already-installed mods. The build-pipeline session (topic 7) separately
owns constructing the structurally-different platform entry points (e.g.
Electron build omitting the mod loader) that the sandboxing section's
disable mechanism depends on.

## Open items carried forward

- Sandboxed execution for end-user mods (Worker/iframe + message-passing
  `api`) — prerequisite to shipping end-user mod support, not designed at
  implementation level here.
- End-user mod discovery/installation/distribution mechanics — packaging
  session (topic 8).
- Platform-specific build entry point construction for the structural
  modding-disable mechanism — build-pipeline session (topic 7).
- Branching scripted-event step lists, and event interruption/cancellation
  — implementation time.
- `waitFor` predicate-function escape hatch's exact contract —
  implementation time.
- Lifecycle hooks (plugin loaded, save loading/migrating) — flagged as
  existing, not designed in depth here.
