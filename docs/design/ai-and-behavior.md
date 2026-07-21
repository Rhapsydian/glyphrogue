# AI & behavior

Deep-dive design doc for how non-player actors decide what to do on their
turn. Produced in the session-12 planning pass (see `BACKLOG.md` for the
roadmap this fits into) — flagged as a gap while writing
`docs/design/custom-ui-and-interactions.md`: only shadowcasting/perception
was ever shared with rendering, and no session had designed actual
decision-making.

## AI as rules on a new `TakeTurn` action type

**The question**: does AI decision-making need its own registration
mechanism (a `registerBehavior(id, behaviorFn)` sibling to
`registerGenerator`/`registerScreen`), or does it fall out of the existing
action/rule pipeline?

**Decision: no new registration primitive.** Every decision made across
this session and the prior one resolved the same way — reuse an existing
mechanism rather than invent a new one (dice rolls reuse `waitFor`, battle
screens reuse `registerScreen` + `lock()`, sound reuses the notification
subscriber). AI fits the same shape: `act()` dispatches a core-shipped
`TakeTurn` action for any non-player actor, and ordinary rules react to
it, matched by component exactly the way `ExplodesOnDeath` is matched
today:

```js
api.registerRule('goblin-chase-ai', 'TakeTurn', (action, ctx) => {
  if (!ctx.hasComponent(action.entity, 'ChasesPlayer')) return;
  return { followOn: [{ type: 'Move', entity: action.entity, to: /* ... */ }] };
});
```

**`core` ships a handful of these as first-party default rules** —
`Wanders`, `ChasesPlayer`, `Flees`, `Guards` marker components with
corresponding built-in `TakeTurn` rules — the same relationship core
already has to its four built-in map generators
(`mapgen-and-editor.md`: "not a closed, core-only set"). Authors compose,
extend, or override them like any other rule; there is no separate "AI
system" boundary to maintain alongside the rule pipeline that already
exists.

**Correction to an earlier draft of this doc, now resolved**: multiple
`TakeTurn` rules matching the same actor is *not* actually "the same
conflict shape any other multi-rule action type already has." The existing
pipeline model (`scripting-api.md`) is built for **additive** reactions —
`explode-on-death` and `poison-on-hit` can both fire on the same `Death`
with no conflict. `TakeTurn` needs **mutually exclusive** choices instead —
an actor can't both `Flee` and `Guard` the same turn.

**Decision: explicit priority selects a single winner.** Every matching
rule's handler still evaluates the same way the pipeline already evaluates
any other action type's matching rules — the only change is the
*selection* step. Each rule declares `options.priority`, either a constant
or a `(action, ctx) => number` function resolved fresh at decision time
using the same `ctx` every rule already receives. The highest resolved
priority wins; that rule's follow-on is applied, the rest are discarded —
no partial application, consistent with this project's general bias toward
explicit, predictable resolution over implicit best-effort guessing. A
simple rule returns a constant and behaves like plain static priority; a
sophisticated one computes something context-sensitive (e.g. "my urgency
to flee scales with how low my health is right now") without needing a
separate utility-AI subsystem — the same "escape hatch, not the default
path" shape as the palette system's raw-color escape hatch.

The four first-party behaviors get fixed default priorities — `Flees` >
`Guards` > `ChasesPlayer` > `Wanders` (self-preservation beats duty beats
aggression beats idling). Ties (equal resolved priority, static or
dynamic) fall back to `scripting-api.md`'s existing dependency-graph load
order — already deterministic, no new tie-break mechanism needed.

## Shared pathfinding primitive

**Decision**: `core` exposes one shared pathfinding primitive —
`ctx.findPath(from, to, opts)` — that `TakeTurn` rules call into,
rather than each chase/flee rule reimplementing A*/Dijkstra-map pathfinding
independently. This mirrors `rendering.md`'s decision to share one
shadowcasting primitive across rendering, AI perception, and light
propagation, and `mapgen-and-editor.md`'s composition primitives ("connect
two points with a corridor" — pathing for generation, not for a moving
actor, but the same "shared primitive, not reinvented per-consumer"
precedent applies).

Perception itself doesn't need new design here: `rendering.md` already
established a shared shadowcasting primitive covering "AI perception," so a
`ChasesPlayer` rule already has a visible-tiles query available — this doc
only adds the pathfinding half of "see the player, then path toward them."

## Relationship to custom battle-system screens

**Scope boundary**: this doc's `TakeTurn`/pathfinding mechanism is for
**map-level, core-visible actors** — creatures wandering, guarding, or
chasing on the map, going through the normal rule pipeline. A
`registerScreen`-based custom battle system (`custom-ui-and-
interactions.md`) is opaque by design — its own internal battle-AI, if it
has one, is private to the screen and has no obligation to use
`TakeTurn` or `findPath` at all. `custom-ui-and-interactions.md`
flagged AI design as a prerequisite to authoring a *non-trivial* custom
battle screen's internals; this doc satisfies that for map-level AI, but a
battle screen's own internal opponent logic remains entirely the screen
author's concern, same as everything else inside an opaque screen.

## Turn cost

**`TakeTurn` itself is zero-cost.** Only the follow-on action it resolves
to (`Move`, `Attack`, etc.) carries a time-units cost against the
scheduler — consistent with how `Attack`'s own `Damage`/`Death` follow-ons
already don't double-charge time separately from `Attack` itself. Deciding
is not an additional turn slice on top of acting.

## Registration conventions inherited from `scripting-api.md`

The built-in `TakeTurn` rules (and any author-added ones) are ordinary
`registerRule` calls, so they inherit `scripting-api.md`'s generic
mechanisms as-is: hard error on an unconfirmed duplicate `id`, the
self-confirming `options.override` mechanism, dependency-graph load
ordering, and the "v1: no sandboxing" trust boundary.

## Open items carried forward

- Exact first-party behavior rule set beyond the four named here (`Wanders`,
  `ChasesPlayer`, `Flees`, `Guards`) — implementation time, same deferral
  pattern as other docs' "exact algorithm" open items.
- Pathfinding algorithm specifics (A* vs. Dijkstra maps vs. both for
  different use cases) — implementation time, matching how
  `mapgen-and-editor.md` deferred exact WFC/CA/BSP internals.
