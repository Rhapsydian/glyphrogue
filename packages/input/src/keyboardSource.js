import { resolveBinding } from './keymap.js';

// Event-driven keyboard adapter (ui-and-input.md). `target` is duck-typed
// against addEventListener/removeEventListener - no default, so tests
// always inject a fake, matching storage.js's injected-first style. Browser
// auto-repeat keydowns are filtered out: the adapter reports discrete
// press/release only, no held-repeat (a game builds that policy itself on
// top, per the doc's engine-level-contract-only boundary).

export function createKeyboardSource({ target, keymap, dispatch }) {
  function handleKeyDown(event) {
    if (event.repeat) return;
    for (const action of resolveBinding(keymap, { device: 'key', code: event.code })) {
      dispatch({ action, phase: 'press' });
    }
  }

  function handleKeyUp(event) {
    for (const action of resolveBinding(keymap, { device: 'key', code: event.code })) {
      dispatch({ action, phase: 'release' });
    }
  }

  target.addEventListener('keydown', handleKeyDown);
  target.addEventListener('keyup', handleKeyUp);

  return {
    stop() {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
    },
  };
}
