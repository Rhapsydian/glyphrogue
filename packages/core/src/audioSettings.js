// Mixing/volume settings (audio.md): "falls out for free," reusing the
// exact keybinding-persistence shape ui-and-input.md already established -
// a settings slice living outside save data, its own storage key, not tied
// to a loaded save. `storage` is any storage.js-shaped { save, load }
// backend. Volumes are plain data ({ master, music, sfx }, each a 0-1
// multiplier) - no wrapper accessors needed, unlike keymap.js's bindings
// which have real reverse-lookup/rebind logic behind them.

export async function saveMixSettings(storage, settings, key = 'mix-settings') {
  await storage.save(key, settings);
}

export async function loadMixSettings(storage, defaults, key = 'mix-settings') {
  const settings = await storage.load(key);
  return settings ?? defaults;
}
