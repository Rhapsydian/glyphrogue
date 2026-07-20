# AI & behavior

Deep-dive design doc for how non-player actors decide what to do on their
turn. Produced in the session-12 planning pass (see `BACKLOG.md` for the
roadmap this fits into) — flagged as a gap while writing
`docs/design/custom-ui-and-interactions.md`: only shadowcasting/perception
was ever shared with rendering, and no session had designed actual
decision-making.

## AI as rules on a new `DecideAction` action type

**The question**: does AI decision-making need its own registration
mechanism (a `registerBehavior(id, behaviorFn)` sibling to
`registerGenerator`/`registerScreen`), or does it fall out of the existing
action/rule pipeline?

**Decision: no new registration primitive.** Every decision made across
this session and the prior one resolved the same way — reuse an existing
mechanism rather than invent a new one (dice rolls reuse `waitFor`, battle
screens reuse `registerScreen` + `lock()`, sound reuses the notification
subscriber). AI fits the same shape: `act()` dispatches a core-shipped
`DecideAction` action for any non-player actor, and ordinary rules react to
it, matched by component exactly the way `ExplodesOnDeath` is matched
today:

```js
api.registerRule('goblin-chase-ai', 'DecideAction', (action, ctx) => {
  if (!ctx.hasComponent(action.entity, 'ChasesPlayer')) return;
  return { followOn: [{ type: 'Move', entity: action.entity, to: /* ... */ }] };
});
```

**`core` ships a handful of these as first-party default rules** —
`Wanders`, `ChasesPlayer`, `Flees`, `Guards` marker components with
corresponding built-in `DecideAction` rules — the same relationship core
already has to its four built-in map generators
(`mapgen-and-editor.md`: "not a closed, core-only set"). Authors compose,
extend, or override them like any other rule; there is no separate "AI
system" boundary to maintain alongside the rule pipeline that already
exists.

Multiple `DecideAction` rules can match the same actor and run as the same
ordered pipeline every other action type uses — a `Flees`-tagged actor with
low health could have both a `Guards` rule and a `Flees` rule registered,
with ordering (or an explicit priority/veto) deciding which follow-on wins,
same conflict shape any other multi-rule action type already has.

## Shared pathfinding primitive

**Decision**: `core` exposes one shared pathfinding primitive —
`ctx.findPath(from, to, opts)` — that `DecideAction` rules call into,
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

**Scope boundary**: this doc's `DecideAction`/pathfinding mechanism is for
**map-level, core-visible actors** — creatures wandering, guarding, or
chasing on the map, going through the normal rule pipeline. A
`registerScreen`-based custom battle system (`custom-ui-and-
interactions.md`) is opaque by design — its own internal battle-AI, if it
has one, is private to the screen and has no obligation to use
`DecideAction` or `findPath` at all. `custom-ui-and-interactions.md`
flagged AI design as a prerequisite to authoring a *non-trivial* custom
battle screen's internals; this doc satisfies that for map-level AI, but a
battle screen's own internal opponent logic remains entirely the screen
author's concern, same as everything else inside an opaque screen.

## Open items carried forward

- Exact first-party behavior rule set beyond the four named here (`Wanders`,
  `ChasesPlayer`, `Flees`, `Guards`) — implementation time, same deferral
  pattern as other docs' "exact algorithm" open items.
- Pathfinding algorithm specifics (A* vs. Dijkstra maps vs. both for
  different use cases) — implementation time, matching how
  `mapgen-and-editor.md` deferred exact WFC/CA/BSP internals.
- Multi-rule ordering/priority for `DecideAction` conflicts beyond the
  general pipeline-ordering mechanism `scripting-api.md` already defines —
  implementation time if a concrete case demands more than that.
