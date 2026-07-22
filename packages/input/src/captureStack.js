// Minimal generic capture stack (ui-and-input.md's "exclusive capture
// stack" decision: the topmost surface claims everything while active).
// Deliberately opaque entries (just an id) - the real screen/dialog/menu
// stack with lifecycle/focus management is a later session's job; this is
// only the mechanism that gates input actions.

export function createCaptureStack() {
  const entries = [];
  return {
    push(id) {
      entries.push(id);
    },
    pop() {
      return entries.pop();
    },
    peek() {
      return entries[entries.length - 1];
    },
    isEmpty() {
      return entries.length === 0;
    },
  };
}
