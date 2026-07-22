# @glyphrogue/input

Physical input → input-action pipeline, kept outside `@glyphrogue/core` on
purpose (`docs/design/ui-and-input.md`): core stays a pure state/rules
engine with no DOM dependency, and this package never reaches back into
core either — it's dependency-free, and hands resolved input actions to
whatever callback the consuming game wires up. Which input-action ids are
"gameplay-intent" (worth turning into a core Action) vs. UI-only
(`confirm`, `cancel`) is entirely the consuming game's concern — this
package has no opinion on input-action vocabulary, same boundary as the
keybinding defaults below.

- `keymap.js` — the input-action keybinding table: `{ [inputAction]:
  BindingEntry[] }`, device-tagged entries (`{device:'key', code}` /
  `{device:'gamepad-button', index}` / `{device:'gamepad-axis', index,
  direction}`) so one input action can mix keyboard and gamepad bindings.
  No default bindings shipped — game-defined.
- `captureStack.js` — a minimal generic push/pop stack of opaque surface
  ids, used only to gate which input actions get captured vs. fall
  through to the game. The real screen/dialog/menu stack (rendering,
  lifecycle, focus management) is a later session's job, built on top of
  this same stack.
- `inputPipeline.js` — routes each input action to whichever surface is
  topmost on the capture stack, or lets it fall through to the game if the
  stack is empty. The "exclusive capture stack" decision (topmost surface
  claims everything) lives here.
- `stateNotifier.js` — a coarse subscribe/notify primitive for DOM state
  binding. Subscribers re-read whatever they need through core's
  inspection API rather than fine-grained dependency-tracked queries; when
  exactly to call `notify()` (e.g. after each fully-resolved core Action)
  is the consumer's job.
- `keyboardSource.js` — event-driven: resolves physical keydown/keyup
  through the keymap into discrete press/release input actions, filtering
  out browser auto-repeat keydowns (no held-repeat in the adapter — a game
  builds auto-repeat policy itself on top).
- `gamepadSource.js` — poll-driven, since the Gamepad API has no
  press/release events: the consumer calls `poll()` once per animation
  frame, and this diffs against the previous frame to edge-detect button
  presses/releases and analog-stick crossings of a deadzone threshold into
  the same discrete input actions a d-pad press would fire. Single active
  gamepad only (first connected).
- `keybindingStorage.js` — `saveKeybindings`/`loadKeybindings` persist a
  keymap as its own settings slice via any `{save, load}`-shaped storage
  (matching `@glyphrogue/core`'s `storage.js` backends, without a
  dependency on that package), entirely outside world-save data.
