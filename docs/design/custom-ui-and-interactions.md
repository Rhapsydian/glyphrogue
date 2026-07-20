# Custom UI surfaces & interaction hooks

Deep-dive design doc for how a game (or later, a mod) registers a wholly
custom interactive screen — a skill-check/dice-roll modal, a talent-tree
screen, a full turn-based battle system, or any other minigame-shaped
interaction — and hooks it into the engine. Produced in the session-10
planning pass (see `BACKLOG.md` for the roadmap this fits into), prompted by
a gap found while reviewing the completed 8-session roadmap: `ui-and-input.md`
only ever documented one concrete core→UI hand-off (`ShowDialogue`), with no
generalized registration contract for authors adding new screen types.
Builds directly on `ui-and-input.md`'s screen/dialog/menu stack and
`scripting-api.md`'s registration conventions and action/rule pipeline —
treat those as prerequisite reading, not re-litigated here.

## Generalizing the core→UI hand-off: `registerScreen`

**The gap**: `ui-and-input.md` resolved exactly one instance of core
triggering UI — a scripted event's `ShowDialogue` step sets a
`PendingDialogue` marker component; the UI layer subscribes and pushes a
stack entry; dismissing clears the marker. That pattern doesn't generalize:
a dice-roll modal, a talent-tree screen, and a battle screen would each need
their own bespoke marker component, and every game/mod adding a new screen
type would mean the UI layer's subscription code has to learn a new
component name. This is the same "named export per content type" problem
`scripting-api.md` already rejected for mod registration — the fix is the
same shape.

**Decision**: one generic registration call, matching the `id`-first
convention every other `api.register*` call already uses:

```js
api.registerScreen(id, {
  render: (payload, ctx) => { /* build/update the DOM surface */ },
  // optional: onOpen/onClose hooks for setup/teardown
})
```

Core replaces the one-off `PendingDialogue` component with a single generic
marker: `PendingUI({ screenId, payload })`. The UI layer's subscription code
is now fixed regardless of how many custom screens a game or mod
registers — it watches for `PendingUI`, looks up the renderer registered
under `screenId`, and hands it `payload`. This mirrors
`mapgen-and-editor.md`'s `registerGenerator(id, generatorFn)`: one interface,
arbitrarily many implementations behind it.

`ShowDialogue` becomes the first built-in consumer of this mechanism rather
than a special case — a scripted event's `ShowDialogue` step is sugar that
sets `PendingUI({ screenId: 'core:dialogue', payload: { text } })` against a
core-registered `'core:dialogue'` screen, using the exact same path a game
author's custom screen would.

**Talent trees fall out of this for free.** A talent tree is entities/
components (a skill-points resource component, a prerequisite graph as
data) plus ordinary rules for "spend point" actions, plus one
`registerScreen` call for the browsing/spending UI, reading and writing
through the same public inspection/mutation API every other consumer uses.
Nothing here warrants a fourth new mechanism beyond what this doc already
covers — it's the same pattern as any other custom screen, just with
comparatively simple internal logic.

## Canvas access and screen nesting

**Can a screen use canvas, or is it DOM-only?** `ui-and-input.md` scoped
screens/dialogs/menus as DOM overlays on top of the canvas game viewport.
That's still the default, but nothing prevents a screen from mounting its
**own** `<canvas>` element inside its own DOM subtree — a battle screen
wanting a glyph-rendered scene reads the same shared glyph-metrics and
palette objects `rendering.md`/`fonts-and-tilesets.md` already expose to
any consumer, canvas or DOM. This is additive, not a new rendering path: a
screen-owned canvas never touches the game-viewport canvas, and most
screens (inventory, talent trees, dialogue) stay plain DOM as before.

**Can screens nest** (a battle screen triggering a called-shot skill-check
sub-screen)? Yes, and it doesn't go through `PendingUI`/core at all — the
same way `ui-and-input.md` already lets purely-UI-initiated screens (the
player pressing a key to open inventory) skip the core round-trip entirely.
A screen's own internal code pushes a sub-screen directly (calling into
another registered `screenId`'s renderer, or the UI stack's push mechanism
directly), since screens are opaque to core either way. `PendingUI` is only
the mechanism for *core-triggered* hand-off; UI-to-UI composition doesn't
need it.

## Screen lifecycle: the pause contract

**The question this resolves**: once a screen is open, does the rest of the
game keep running underneath it? For a battle screen or a full minigame,
clearly not — but nothing in prior docs said so explicitly, and it looked
at first like it might need a new pause primitive (a paused sub-scheduler,
or scoping the turn scheduler's active-actor roster to just the screen's
participants).

**Decision: no new primitive.** `core-architecture.md`'s engine loop is
already strictly sequential — the scheduler asks for the next actor and
calls its `act()`, and cannot advance to the next actor until the current
one's `act()` resolves or explicitly suspends via `lock()`/`unlock()`.
Opening a `registerScreen` surface is simply **holding that same `lock()`
open** for the screen's entire lifetime, rather than just until one input
action arrives. Because nothing else in the engine can run while one
actor's turn is suspended, the rest of the world is *already* paused the
moment a screen opens — for free, with no scheduler-roster-scoping and no
second `Engine`/`Scheduler` instance, no matter how large the screen's own
internal logic turns out to be (one dice roll, or an entire battle).

**The screen is opaque to core.** It reads world state through the same
public inspection API every consumer (game runtime, `editor`, mods) already
uses, and its internal logic — a roll animation, a full turn-based combat
system with its own turn order and AI, a rhythm minigame, anything — is
entirely private. Core has no visibility requirement into what happens
inside a screen while it's open, and no rule fires for anything the screen
does internally.

**Closing a screen dispatches exactly one ordinary core Action** carrying
whatever result payload the screen produced — `ResolveSkillCheck`,
`ResolveBattle`, or any game-defined action type, author's choice, no
special "screen result" action kind reserved by core. That action flows
through the normal per-action-type rule pipeline exactly like `Attack` or
`Move` does, so mods and other rules *can* hook the net outcome of a custom
screen (loot, damage, a quest flag) even though they never saw what happened
inside it. Core applies whatever mutation that action's rule produces, the
screen pops off the stack, `unlock()` fires, and the suspended actor's turn
resumes or completes — no different in kind from the engine picking back up
after any other locked turn.

## Cosmetic animation vs. interactive mid-resolution

Two distinct cases were previously conflated as one open "animation timing"
question (`core-architecture.md`, `rendering.md`, `ui-and-input.md` all
carried a version of it). They resolve differently:

**Cosmetic delay** — a dice-roll animation plays before revealing a result
that's already been decided, with no player action expected mid-animation.
This needs **no new mechanism**: it's the same model/view decoupling
`rendering.md` already established for tweened movement. The rule resolves
the roll instantly against the model; the registered screen animates using
the payload it already received, and pops itself (dispatching its closing
action) whenever the animation finishes. Core never waits on the animation
itself — only on the screen's stack presence, per the pause contract above.

**Interactive mid-resolution** — e.g. a player spending a resource to
reroll a failed check *before* it's final. This can't resolve in one
synchronous rule call, so it's modeled as a short multi-step sequence using
the **existing `registerScriptedEvent`/`waitFor` mechanism** from
`scripting-api.md`, rather than inventing a second timing concept: roll →
present via the registered screen → `waitFor` a reroll-input action (loop)
or a confirm-input action → dispatch the closing `ResolveSkillCheck` action
only once confirmed. The screen doesn't need special core support for
"pause mid-animation for input" beyond what `waitFor` already provides,
since the screen itself is what's holding `lock()` open regardless.

**Correction to an earlier draft of this doc**: this resolves the
lock/unlock-vs-animation question **only for `registerScreen`-triggered
animation** — a screen's own animation gating its own closing action. It
does **not** resolve `rendering.md`'s original open item, which is about
*ordinary* per-actor movement/attack tweening during a normal multi-actor
turn: whether `lock()` stays held for each animation's full duration
(serializing turns, risking the "AI turn spam" pacing problem) or overlap
is allowed (needing an undesigned render-event buffer). That question
remains fully open — see `ai-and-behavior.md`'s "Open items," since
`DecideAction`-driven creatures moving/attacking every round is exactly the
scenario this bears on.

## Combat/battle-system swappability

**Decision: `Attack`/`Damage`/`Death` is a first-party default rule set,
not an exclusive core mechanism** — the same relationship core already has
to its four built-in map generators (`mapgen-and-editor.md`: "core ships
built-in implementations... this is not a closed, core-only set"). A game
building a wholly custom battle system defines its own action vocabulary
(`CastSpell`, `UseCombatCard`, whatever fits) and simply never triggers the
default `Attack` chain for those encounters. Nothing structurally requires
every game to route combat through core's default action names.

**A modal battle system uses the exact same mechanism as a dice roll**: a
`registerScreen` surface, opened via `PendingUI`, holding the current
actor's `lock()` open for as long as it's active, with entirely private
internal logic (its own turn order, its own AI, its own state — none of it
expressed as core actions/rules while the screen is open), closing with one
`ResolveBattle`-shaped action that the normal rule pipeline sees. No
distinct scheduler, no actor-roster scoping, no new Engine concept — "enter
battle, fight, return to the map" is a presentation and pause detail, not a
new architectural primitive.

**Scope boundary: turn-based only.** This doc assumes any custom battle
system still resolves on the same turn-based footing as the rest of the
engine — the screen opens, does its own (possibly turn-structured)
resolution, and closes. A battle system with genuinely different time
semantics — **real-time-with-pause**, where the screen's own internal
clock runs independent of the scheduler's time-units model — is explicitly
**out of scope** here, the same way local co-op was ruled out of scope in
`ui-and-input.md`. Flagged as a `BACKLOG.md` future item, not designed in
this pass.

## Registration conventions inherited from `scripting-api.md`

`registerScreen` is an ordinary `id`-first `api.register*` call, so it
inherits `scripting-api.md`'s generic mechanisms as-is: hard error on an
unconfirmed duplicate `id`, the self-confirming `options.override`
mechanism, dependency-graph load ordering, and the "v1: no sandboxing"
trust boundary — a registered screen is arbitrary author-supplied
DOM/canvas code with full access, same trust level as any other
registration.

## Scope boundary

This doc defines the **authoring contract for custom screens** — the
`registerScreen` mechanism, the pause/lifecycle contract, and how a
screen's result re-enters the rule pipeline. It does not re-decide anything
already settled in `ui-and-input.md` (the capture stack, DOM state binding,
keybindings) or `scripting-api.md` (the action/rule pipeline, registration
conventions, versioning) — both are prerequisites this doc builds on
directly.

**Explicitly out of scope, flagged as `BACKLOG.md` future items**:
real-time-with-pause battle systems (see above); audio hooks for
screen-driven moments (a dice-clatter SFX, a battle-transition stinger) —
no audio design session exists yet at all, not specific to this doc;
AI/behavior-tree design for custom battle-system opponents — undesigned
anywhere in the roadmap so far, and a prerequisite to actually authoring a
non-trivial custom battle screen's internals, even though the *hook-in*
mechanism this doc defines doesn't depend on it.

## Open items carried forward

- `registerScreen`'s exact render-callback contract (how it integrates with
  whatever DOM/framework choice a game makes, per `ui-and-input.md`'s
  "no frontend framework assumed" stance) — implementation time, same
  deferral pattern as every other doc's signature-level-only decisions.
- Real-time-with-pause battle systems — explicitly out of scope; a
  `BACKLOG.md` future item.
- Audio design (no session has covered this at all) — `BACKLOG.md` future
  item.
- AI/behavior-tree design for battle-system opponents — `BACKLOG.md` future
  item.
- Exact closing-action naming conventions (`ResolveBattle` etc.) are
  author's choice, not core-mandated — nothing further to decide here.
