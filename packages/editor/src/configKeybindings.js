// Config UI's Keybindings tab logic (docs/design/editor.md: "Config UI" -
// an input-action list, each showing its current binding(s), variable-
// length array-per-action, plus a "capture next key" affordance). Pure
// logic, kept separate from ConfigUI.svelte, same split narrowForm.js/
// configPalette.js already use for their own tools. Neither input actions
// nor palette tokens are a registered concept (editor.md) - the input-
// action vocabulary is supplied by the caller, not derived from a
// manifest.

function bindingLabel(entry) {
  switch (entry.device) {
    case 'key':
      return `Key: ${entry.code}`;
    case 'gamepad-button':
      return `Gamepad button ${entry.index}`;
    case 'gamepad-axis':
      return `Gamepad axis ${entry.index} (${entry.direction})`;
    default:
      return 'Unknown binding';
  }
}

// One row per known input-action id, in the order the caller supplies -
// not derived from bindings' own keys, so an action with zero bindings
// yet still gets a row to bind into.
export function buildKeybindingRows(bindings, inputActions) {
  return inputActions.map((action) => ({
    action,
    entries: (bindings[action] ?? []).map((entry) => ({ entry, label: bindingLabel(entry) })),
  }));
}

export function addBinding(bindings, action, entry) {
  return { ...bindings, [action]: [...(bindings[action] ?? []), entry] };
}

export function removeBinding(bindings, action, index) {
  return { ...bindings, [action]: (bindings[action] ?? []).filter((_, i) => i !== index) };
}

export function serializeKeybindings(bindings) {
  return `export default ${JSON.stringify(bindings, null, 2)};\n`;
}

export function keybindingsPath() {
  return 'src/settings/keybindings.js';
}
