# @glyphrogue/input

Physical input → input-action pipeline, kept outside `@glyphrogue/core` on
purpose (`docs/design/ui-and-input.md`): core stays a pure state/rules
engine with no DOM dependency, and this package never reaches back into
core either — it's dependency-free, and hands resolved input actions to
whatever callback the consuming game wires up.

So far: the input-action keymap (`keymap.js`), an exclusive capture stack
for gating input actions to the topmost UI surface (`captureStack.js`), the
pipeline that ties them together (`inputPipeline.js`), and a coarse
subscribe/notify primitive for DOM state binding (`stateNotifier.js`).
Physical input sources (keyboard, gamepad) and keybinding persistence land
in later checkpoints of the same session — see
`../../docs/session-logs/` once that session log is written.
