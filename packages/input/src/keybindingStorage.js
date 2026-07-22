import { createKeymap } from './keymap.js';

// Remapped bindings persist as a separate settings slice, not world-save
// data (ui-and-input.md) - entirely outside coreSchemaVersion/
// gameDataVersion, readable/writable with no save loaded. `storage` is any
// {save(key, data), load(key)}-shaped object (core's storage.js backends
// duck-type this without needing to depend on @glyphrogue/core here).

export async function saveKeybindings(storage, keymap, key = 'keybindings') {
  await storage.save(key, keymap.bindings);
}

export async function loadKeybindings(storage, defaults, key = 'keybindings') {
  const bindings = await storage.load(key);
  return createKeymap(bindings ?? defaults);
}
