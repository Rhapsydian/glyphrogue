# @glyphrogue/input

Physical input → input-action pipeline, kept outside `@glyphrogue/core` on
purpose (`docs/design/ui-and-input.md`): core stays a pure state/rules
engine with no DOM dependency, and this package never reaches back into
core either — it's dependency-free, and hands resolved input actions to
whatever callback the consuming game wires up.

So far: the input-action keymap (`keymap.js`), an exclusive capture stack
for gating input actions to the topmost UI surface (`captureStack.js`), the
pipeline that ties them together (`inputPipeline.js`), a coarse
subscribe/notify primitive for DOM state binding (`stateNotifier.js`), and
an event-driven keyboard adapter (`keyboardSource.js`) that resolves
physical keydown/keyup events through the keymap and reports discrete
press/release input actions (no held-repeat — a game builds auto-repeat
policy itself on top).

The gamepad adapter and keybinding persistence land in later checkpoints of
the same session — see `../../docs/session-logs/` once that session log is
written.
