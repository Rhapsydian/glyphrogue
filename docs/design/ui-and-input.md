# UI/UX & input framework

Deep-dive design doc for Glyphrogue's UI/input layer. Produced in the
session-6 planning pass (see `BACKLOG.md` for the roadmap this fits into).
Treat this as the source of truth for the topics below — `DESIGN.md`
currently folds this entirely into its "Rendering" paragraph; it should
gain its own UI/Input section (trimmed summary linking here) once this doc
lands, same pattern as the other five docs.

Scope for this session: menus, dialogs, inventory/equipment screens,
keybinding & remapping, accessibility, and controller support — the
generic *system* these are built from, not literal screen layouts.
Concrete screen designs (an actual inventory grid, a specific pause menu)
are game content authored against this system, same boundary
`fonts-and-tilesets.md` draws between the tileset pipeline and an actual
tileset.

## Input → action pipeline

**What's already decided, for context**: `core-architecture.md` models the
turn engine on rot.js's `Scheduler`/`Engine`, with `lock()`/`unlock()`
letting an actor's turn suspend on async player input. How that suspension
interacts with the DOM input layer was explicitly left open for this
session.

**Decision: the input adapter lives outside `packages/core`, not inside
it.** Raw keyboard/gamepad input is inherently a browser/DOM concern, and
core's established pattern everywhere else (rendering, mapgen, editor) is
that consumers reach core only through its one public inspection/mutation
API — core never reaches out into a consumer's domain. Input is no
different: core only ever receives already-resolved input, dispatched
against its existing action-dispatch surface. The physical→logical mapping
lives entirely in a separate input-adapter piece, alongside the DOM UI
layer.

That adapter turns physical input (a keypress, a gamepad button) into
**input actions** — a deliberately different term from core's own
"Action" vocabulary (`Move`, `Attack`, `OpenDoor` — proposed state changes
gated by rules, per `core-architecture.md`). Most input actions
(`confirm`, `cancel`, `menu-up`) never become a core Action at all; only
gameplay-intent ones (`move-north`) get dispatched onward, and only once
nothing claims them first (below).

**Decision: an exclusive capture stack.** Every input action goes to
whichever UI surface is topmost on the stack (see next section); if
nothing is on the stack, it falls through to core's Action dispatcher.
This is deliberately simple — the topmost surface claims *everything*
while active, not a declared subset — revisit only if a concrete case
demands partial fall-through (e.g. a non-modal HUD element wanting to let
movement through while still capturing one specific input action).

This resolves the `lock`/`unlock` question directly: the turn engine's
`act()` calls `lock()` when it needs player input; `unlock()` fires only
when a gameplay-intent input action reaches the dispatcher with nothing
above it on the capture stack. Opening a menu doesn't need a separate
"pause input" mechanism — it's just pushing something onto the stack, which
transparently starves the dispatcher of input actions until it's popped.

## Screen/dialog/menu stack

**Decision: the stack is UI-owned; core has no awareness it exists.**
Consistent with the input-adapter placement above, "screens," "dialogs,"
and "menus" are not core concepts — core only ever sees state and Actions.
A stack entry is a plain descriptor: an id/type, whatever local state it
owns (e.g. a selected inventory slot), and read/write access to core
exclusively through the same public inspection/mutation API every other
consumer uses — no special path, same no-backdoor-access rule
`core-architecture.md` establishes for `editor` and mods.

**Render and capture are decoupled.** Every stack entry renders (bottom to
top — a dialog overlays the game view rather than replacing it); only the
topmost entry captures input actions, per the previous section. Opening a
menu doesn't hide what's beneath it by default.

**The `ShowDialogue` problem, resolved without core calling into UI.**
`scripting-api.md`'s scripted events can include a `ShowDialogue` step
action, executed core-side. Core can't call into the UI layer directly —
that would break the boundary the input-pipeline section just established,
and there'd be no single UI layer to call into anyway (a headless
consumer, a test harness, etc. has none). Instead, `ShowDialogue` sets
inert core state (something like a `PendingDialogue` marker) exactly the
way any other action mutates state — no different in kind from `rendering
.md`'s FOV/light state being exposed as queryable results rather than core
calling the renderer directly. The UI layer's state subscription (next
section) notices that state and pushes the corresponding surface onto its
own stack. Dismissing is symmetric: the player's `confirm` input action
becomes a core Action that clears the state, and the scripted event's
`waitFor` step (`scripting-api.md`'s existing multi-step mechanism) sees
that change and advances — no new event mechanism needed.

Purely UI-initiated screens (the player presses a key to open inventory)
skip this round-trip entirely: the input adapter pushes onto its own stack
directly, with no core state involved. Only core-triggered presentation
needs the state round-trip.

## DOM state binding

**No frontend framework is assumed.** Nothing in this project's existing
docs commits to React/Vue/Svelte/etc. — `DESIGN.md`'s only
framework-adjacent line picks "no framework" for testing, matching the
project's low-ceremony, minimal-dependency bias
(`pixelloom`/`pixelyph`-style). Core stays agnostic here the same way it's
already agnostic about Canvas vs. DOM rendering (`rendering.md`): it
exposes a plain, framework-agnostic subscribe/notify primitive, and
whatever the DOM layer actually is — vanilla, or a game project adding a
framework of its own — builds on top of that.

**Decision: coarse notification, not fine-grained query subscriptions.**
A subscriber is notified once after each fully-resolved core Action
(including its follow-on chain — e.g. a `ShowDialogue` follow-on notifies
immediately, not after the rest of the turn's other actors finish) and
re-reads whatever it needs through the existing inspection API, rather
than subscribing to specific fine-grained queries with dependency
tracking. Glyphrogue is turn-based, not per-frame — state changes at
action cadence, not 60fps — so the re-read cost of "just re-check
everything you care about" is trivial at this update rate, and it avoids
building a dependency-tracking system this session has no other reason to
need.

Writes go back through the same public inspection/mutation API, keeping
core the single source of truth — no separate write channel for DOM UI.

This stays independent of `rendering.md`'s still-open `lock`/`unlock`-vs-
animation-duration question: the state-change notification fires on the
instant model update, exactly like the model/view split `rendering.md`
already establishes for tweened movement. However that open question
resolves, it only affects how long the *view* takes to catch up visually —
not when this notification fires.

## Keybinding & remapping

**Decision: keyed by input action, each holding an array of bindings.**
`{ 'move-north': [...], 'confirm': [...] }` rather than one physical key
mapping to one action — roguelikes routinely want arrows *and* vi-keys (or
a primary and secondary gamepad binding) live on the same input action at
once, and an array-per-action shape supports that without a special case.

**Decision: mechanism is reusable, defaults are game-defined.** The
remap/persist/capture-stack machinery is something Glyphrogue provides
once; the actual default bindings, and the input-action vocabulary beyond
built-ins like `confirm`/`cancel`, are defined by the game — the same
relationship core already has to a game's own Actions and rules
(`core-architecture.md`).

**Decision: remapped bindings persist as a separate settings slice, not
world-save data.** They use `core-architecture.md`'s existing
storage-backend abstraction (localStorage for static builds, filesystem
for Electron) but live entirely outside the `coreSchemaVersion`/
`gameDataVersion` save split — a keybinding preference isn't tied to a
specific save file or character, and shouldn't need a save loaded to be
read or changed.

## Controller/gamepad support

Gamepad input feeds the same input-action pipeline as keyboard (previous
sections) — there is no parallel input system. One plumbing wrinkle,
not a design fork: the browser Gamepad API is **poll-based** (no
press/release events — `navigator.getGamepads()` is diffed against the
previous frame), unlike keyboard's event-driven `keydown`/`keyup`. The
adapter therefore has two different internal mechanisms — one listening,
one polling-and-edge-detecting — that both emit into the same input-action
stream.

**Decision: discrete edges only, no held-repeat in the adapter.** The
adapter reports press/release as discrete input actions and nothing about
"repeat while held." A game that wants holding a direction to auto-repeat
movement builds that policy itself on top of these primitives — matches
the "engine-level contract only, no per-game content" boundary this
session is holding to elsewhere (e.g. keybinding defaults, above).

**Decision: analog stick input becomes a discrete directional input
action past a deadzone threshold**, the same input action a d-pad press
would fire. There is no continuous/analog input action anywhere in this
pipeline — movement is turn-based and discrete, so analog tilt has nothing
continuous to drive.

**Decision: keymap binding entries carry a device tag.** Section 4's
binding arrays extend from bare key codes to a small tagged shape —
`{ device: 'key', code: 'ArrowUp' }` vs. `{ device: 'gamepad-button',
index: 12 }` — so a single input action's binding list can mix keyboard
and gamepad bindings uniformly, without assuming every binding is a
keyboard one.

**Scope boundary: single active gamepad only.** The first connected
gamepad is used; local co-op / multiple simultaneous controllers is
explicitly out of scope — nothing in any prior doc discusses multiplayer,
and it isn't assumed here either.

## Accessibility

**Decision: focus management rides the capture stack.** When a surface is
pushed (screen/dialog/menu stack, above), DOM focus moves into it and
traps there for modal surfaces; popping restores focus to whatever held it
before. This falls directly out of the stack model already decided rather
than needing a separate mechanism.

**Decision: the canvas viewport is an explicit non-goal for screen
readers.** The map/entity glyph grid is drawn to canvas with no accessible
DOM equivalent; making it screen-reader-accessible would mean a genuinely
separate text-description system, not a natural extension of anything
decided in this doc. Flagged as a real future accessibility addon in
`BACKLOG.md`, not designed here.

**Decision: colorblind support is a swappable palette, mechanism only.**
`rendering.md` already makes the palette one theme object both render
paths read from, specifically so it's reskinnable by swapping the object —
colorblind support is just another theme swap a player can select, no new
mechanism required. This doc decides that palettes are swappable and
player-selectable; it does not ship specific colorblind-safe color values,
consistent with the base palette itself also being game-authored content
rather than something core ships. A default accessible palette is flagged
as a `BACKLOG.md` addon, not decided here.

## Open items carried forward

- **UI/text scaling vs. the shared cell-grid contract** — respecting
  browser zoom/font-size preferences potentially touches `pixelsPerEm`
  (`rendering.md`, `fonts-and-tilesets.md`); deferred rather than decided
  as a side effect of this session, since it could have real implications
  for how the canvas viewport sizes itself.
- **`lock`/`unlock` vs. animation-duration timing** — still open per
  `rendering.md`/`core-architecture.md`; this doc's coarse state
  notification (above) is independent of how that resolves, so nothing
  here blocks on it, but the question itself isn't answered by this doc
  either.
- **Accessible alternative/description layer for the canvas viewport** —
  flagged as a `BACKLOG.md` accessibility addon, not designed here.
- **Shipped default colorblind-safe palette** — flagged as a `BACKLOG.md`
  accessibility addon, not designed here.
