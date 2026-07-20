# Audio

Deep-dive design doc for `core`'s audio surface. Produced in the session-11
planning pass (see `BACKLOG.md` for the roadmap this fits into) — audio was
named as a `core` responsibility in the original `DESIGN.md` scaffold but
never got its own session until this gap was flagged while writing
`docs/design/custom-ui-and-interactions.md`.

## Core→audio hand-off: reactive, not core-triggered

**The question**: does `core` need a way to explicitly command sound the
way a scripted event commands dialogue (`ui-and-input.md`'s
`PendingDialogue`), or can audio just react to what already happened?

**Decision: reactive by default.** Audio sits much closer to `rendering.md`
than to dialogue — "play a clang on `Attack` connecting" or "play a
footstep on `Move`" is fully derivable from *which action just resolved*,
nothing needs to command it. Audio reuses the exact same coarse
subscribe/notify primitive `ui-and-input.md` built for DOM state binding
(notified once per fully-resolved action, re-read whatever's relevant) —
no new core-state concept, no `PendingSound` marker:

```js
api.registerSound(id, { trigger: actionType, source, match?: (action, ctx) => boolean })
```

`trigger` is an action type; the optional `match` predicate narrows further
by component (e.g. "only if the entity has `Undead`"), the same
component-query shape `registerRule` already uses. An audio subscriber
watches the same per-action notification stream `rendering.md`'s renderer
and `ui-and-input.md`'s DOM layer already watch, and plays whichever
registered sound(s) matched.

**Exception: `registerScreen` surfaces call playback directly.**
`custom-ui-and-interactions.md` already established that a custom screen is
opaque and privately does whatever it wants internally — a dice-roll
clatter loop, a battle-transition stinger. Screens call the same
`playSound`/`playMusic` functions a reactive registration would resolve to,
just directly rather than through the trigger-matching mechanism. This
isn't a second audio mechanism, just the one playback API used two ways:
declaratively (registered triggers) or imperatively (screen-internal calls).

## Backend: no swappable implementation

**Decision: one concrete Web Audio API-based implementation, not a
dependency-injected/swappable backend** — unlike the input adapter
(`ui-and-input.md`, DOM-specific) or the `platform` capability
(`DESIGN.md`, Steamworks vs. no-op), which exist specifically because
those things are genuinely platform-divergent. Audio has no second platform
to abstract for: Web Audio API is available identically across all four of
Glyphrogue's declared build targets (static HTML, GitHub Pages, itch.io,
and Electron, since Electron is Chromium under the hood). Defining an
interface with exactly one implementation ever behind it would be the same
speculative abstraction this project's docs have avoided consistently
elsewhere.

The specific choice of raw Web Audio API vs. a thin convenience wrapper
(Howler.js-style) is genuinely implementation-time detail — deferred the
same way `core-architecture.md` deferred the ECS library bake-off and
`mapgen-and-editor.md` deferred exact algorithm internals.

## Mixing & settings

**Falls out for free**: volume/mixing (master/music/SFX sliders) persists
as a settings slice outside save data, reusing the exact mechanism
`ui-and-input.md` already established for keybinding persistence — not tied
to a specific save file or character, readable/writable without a save
loaded. No new persistence concept needed.

## Scope boundary

This doc decides the **hand-off model** (reactive-by-default, screens as
the one direct-call exception) and the **backend question** (no swappable
implementation). It does not design specific sound-asset formats, a content
pipeline for authoring/importing audio files, or music transition/crossfade
mechanics beyond noting they're a `playMusic` implementation detail —
consistent with how other docs deferred algorithm/format-level specifics.

## Open items carried forward

- Raw Web Audio API vs. a thin wrapper library — implementation time.
- Music crossfade/transition mechanics (relevant to `custom-ui-and-
  interactions.md`'s battle-transition-stinger example) — implementation
  time.
- Sound-asset authoring/import pipeline — not designed here; would follow
  whatever pattern `build-pipeline.md`'s content-import story generalizes
  to, not a new concept specific to audio.
