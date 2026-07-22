// The remap/persist/capture-stack machinery is game-agnostic
// (ui-and-input.md) - no default bindings or input-action vocabulary is
// shipped here, both are game-defined.

function bindingKey(entry) {
  switch (entry.device) {
    case 'key':
      return `key:${entry.code}`;
    case 'gamepad-button':
      return `gamepad-button:${entry.index}`;
    case 'gamepad-axis':
      return `gamepad-axis:${entry.index}:${entry.direction}`;
    default:
      throw new Error(`Unknown binding device: ${entry.device}`);
  }
}

function buildLookup(bindings) {
  const lookup = new Map();
  for (const [inputAction, entries] of Object.entries(bindings)) {
    for (const entry of entries) {
      const key = bindingKey(entry);
      const actions = lookup.get(key) ?? [];
      actions.push(inputAction);
      lookup.set(key, actions);
    }
  }
  return lookup;
}

export function createKeymap(bindings = {}) {
  return {
    bindings: structuredClone(bindings),
    lookup: buildLookup(bindings),
  };
}

export function resolveBinding(keymap, entry) {
  return keymap.lookup.get(bindingKey(entry)) ?? [];
}

export function bindingsFor(keymap, inputAction) {
  return keymap.bindings[inputAction] ?? [];
}

export function rebind(keymap, inputAction, entries) {
  const bindings = { ...keymap.bindings, [inputAction]: entries };
  return createKeymap(bindings);
}
