# Core architecture & game loop

Deep-dive design doc for `packages/core`. Produced in the session-2 planning
pass (see `BACKLOG.md` for the roadmap this fits into). Treat this as the
source of truth for the topics below — `DESIGN.md` will be trimmed to a
short summary linking here once the doc lands.

## Data model: ECS (components), actions/rules (not systems)

**What ECS is**, for context: Entity Component System is an alternative to
classic OOP inheritance (`class Player extends Creature extends Entity`).
An **entity** is just an ID; a **component** is a plain data bag attached
to an entity (`Position {x,y}`, `Health {current,max}`, `Inventory
{items}` — an entity has whichever components it needs, so an exploding
barrel is `Position` + `Health` + `ExplodesOnDeath`, no inheritance
hierarchy required); a **system** is logic that runs over every entity
holding a given set of components (a movement system processes all
entities with `Position` + `Velocity`).

The component half of ECS — composable, serializable data — is a clean fit
for Glyphrogue. The system half — continuous per-frame sweeps — is not:
turn-based games don't want continuous system ticks, and system-to-system
sequencing gets awkward for "resolve this attack, then let follow-on
effects fire" logic. This is a known problem in turn-based ECS engines,
not specific to Glyphrogue ([gridbugs.org](https://www.gridbugs.org/modifying-entity-component-system-for-turn-based-games/)).

**Decision**: entities/components for data storage (candidate library:
[bitECS](https://github.com/NateTheGreatt/bitECS) — zero-dep, ~5kb,
TS-native, SoA/AoS, built-in serialization helpers, fits the
`pixelloom`-style minimal-dependency discipline from `DESIGN.md`; worth a
short bake-off against alternatives when implementation starts, not
re-litigating here). Game logic is expressed as **actions + rules**
instead of per-frame systems:

- An **action** describes a proposed state change (`Move`, `Attack`,
  `OpenDoor`, a scripted-event trigger, etc.).
- A **rule** gates which actions are legal in the current state and what
  follow-on actions they trigger (an `Attack` rule might validate range,
  then emit a `Damage` action and possibly a `Death` action).

The rule layer is the intended extension point for the plugin/scripting
API (session 4 of the roadmap) — a mod or a game's own content registers
rules the same way, whether it's first-party content or a third-party mod
(see "Modding" below).

## Turn-based scheduling: time-units engine

Two established patterns exist for turn scheduling:

- **Speed-based simple scheduling**: each actor has a speed = ticks-between-
  turns; a priority queue picks who acts next. Simple but coarse — no
  partial-turn/variable-cost actions.
- **Time-units system** (energy-budget model, as used by e.g. Cogmind):
  every actor gets a fixed time-unit budget per round; actions cost a
  variable amount; the actor with the most remaining time-units acts next;
  budgets can go negative, front-loading expensive actions
  ([Grid Sage Games](https://www.gridsagegames.com/blog/2019/04/turn-time-systems/)).

**Decision**: time-units scheduling, for the fine-grained variable action-
cost fidelity (a heavy attack costs more time than a step) without a
separate lookup table for "how many ticks did that take." Naming is
"time units" specifically, not Cogmind's "time-energy" — same mechanism,
different label, to avoid implying an unrelated resource system.

**Engine loop**: modeled on rot.js's `Scheduler` + `Engine` pattern — the
engine repeatedly asks the scheduler for the next actor and calls its
`act()`, and supports `lock()`/`unlock()` so an actor's turn can suspend
cleanly on async player input rather than blocking the JS thread (the
scheduler can't just `while(true)` and wait for a keypress in a browser)
([rot.js docs](https://github.com/ondras/rot.js/blob/master/manual/pages/timing/scheduler.html)).
Doc detail still needed at implementation time: the exact `act()` contract,
and how `lock`/`unlock` interacts with the DOM input layer from
`DESIGN.md`'s hybrid Canvas+DOM rendering split.

## Save/load & serialization

**What a DTO is**, for context: a Data Transfer Object is a plain data
structure whose only job is representing data being stored or passed
around — no behavior, no coupling to runtime classes.

**Decision**: saves are built from DTOs, not serialized ECS internals
directly. A save has two independently-versioned slices:

- `coreSchemaVersion` + a `core` payload — the DTO shape for whatever
  `packages/core` itself defines and knows how to serialize (position,
  health, inventory, scheduler/time-units state, etc.). Core owns this
  version and ships its own migration functions for it.
- `gameDataVersion` + a `game` payload — whatever a specific downstream
  game (or its mods) added via the plugin API (custom quest flags, custom
  item types, mod-defined components). This evolves on the game's own
  release cadence, independent of which core version it's built against.
  Core can't own migrations for data it doesn't know about — the game/mod
  layer supplies its own migration functions for its own slice, using the
  same versioned-migration mechanism core defines generically.

Practical rules:

- Persist only essential state; recompute transient/derived state (FOV
  cache, pathfinding caches, AI scratch data) on load instead of
  serializing it.
- Migrations are small, stepwise functions applied in sequence until the
  save reaches the current version — same shape as a DB migration chain,
  each independently testable.
- Format: JSON (matches the project's readable-over-fast bias elsewhere).
- Storage backend is abstracted behind an interface — localStorage for
  static/GitHub Pages/itch.io builds, filesystem for Electron (atomic
  temp-file-then-rename writes there to avoid corruption on crash). Actual
  backend selection/config is a packaging-session concern (topic 8), not
  decided further here.

## `core` / `editor` boundary, and modding

`core` exposes **one public inspection/mutation API** — a defined surface
for reading and changing world state (move an entity, edit a map cell,
query/set components, register rules) — rather than giving consumers raw
access to internal ECS storage. Everything that touches core state goes
through this same surface:

- A shipped game's own runtime.
- A game's own first-party content, if authored via the plugin API (see
  below).
- `packages/editor`, as a privileged, dev-only consumer — not a special
  case with backdoor access.
- End-user mods, if/when that's built out (see below).

This is deliberate: keeping `editor` decoupled from core internals, and
routed through the same API a mod would use, keeps the door open for
`editor` (or a subset of it) to later run as a standalone "mod tools"
release distributed to players — without redesigning the boundary at that
point. That distribution question itself belongs to the packaging session
(topic 8) and isn't decided here.

**Modding, scoped for this doc**: two distinct things both currently get
called "mods," worth keeping separate:

1. **A game's own content authored via the plugin API** — a downstream
   game's entities, items, creatures, and map generators, written as TS/JS
   modules against Glyphrogue's plugin API. This is core infrastructure —
   needed for any game to exist at all — and is the primary target of the
   scripting-api session (topic 4).
2. **End-user mods for a shipped game** — third-party, post-ship content
   that hooks into a game's own content, using the same plugin API
   mechanism. Confirmed as real value to pursue, not just first-party
   authoring, but the full story (distribution, compatibility,
   sandboxing) is scoped to the scripting-api session (topic 4) and the
   packaging session (topic 8), not this one. One open item flagged for
   that session specifically: `DESIGN.md` currently says "no sandboxing in
   v1, mods run with full JS access" — reasonable for first-party content,
   but running arbitrary third-party JS from end-user mods raises the
   trust bar and should be revisited there rather than quietly inherited.

**Editor preview modes**, resolving the scheduler-interaction question:
rather than one editor mode, two:

- **Static edit mode** (default): the time-units scheduler is not running;
  edits (moving entities, editing map cells, tuning procgen seeds/params)
  go directly through the inspection/mutation API against otherwise-static
  world state.
- **Playtest mode**: the real time-units scheduler is active, with both
  **continuous run** and **single-step** controls. Single-step advances
  exactly one action/tick at a time, so a developer can step through
  scripted events in order rather than only observing a continuous
  play-through — this was specifically called out as a requirement for
  debugging scripted event sequences.

## Open items carried forward

- ECS library bake-off (bitECS vs. alternatives) at implementation time.
- `act()` contract and lock/unlock-to-DOM-input interaction, at
  implementation time.
- Storage backend selection/config — packaging session (topic 8).
- End-user mod distribution story for `editor` — packaging session
  (topic 8).
- Mod sandboxing for end-user mods (vs. first-party content) — scripting-
  api session (topic 4).
