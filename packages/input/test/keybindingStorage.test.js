import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeymap, bindingsFor } from '../src/keymap.js';
import { saveKeybindings, loadKeybindings } from '../src/keybindingStorage.js';

function createFakeStorage() {
  const store = new Map();
  return {
    async save(key, data) {
      store.set(key, JSON.parse(JSON.stringify(data)));
    },
    async load(key) {
      return store.get(key);
    },
  };
}

test('save then load roundtrips the rebound keymap', async () => {
  const storage = createFakeStorage();
  const keymap = createKeymap({ 'move-north': [{ device: 'key', code: 'KeyW' }] });

  await saveKeybindings(storage, keymap);
  const loaded = await loadKeybindings(storage, {});

  assert.deepEqual(bindingsFor(loaded, 'move-north'), [{ device: 'key', code: 'KeyW' }]);
});

test('loading with nothing stored yet falls back to defaults', async () => {
  const storage = createFakeStorage();
  const defaults = { 'move-north': [{ device: 'key', code: 'ArrowUp' }] };

  const loaded = await loadKeybindings(storage, defaults);

  assert.deepEqual(bindingsFor(loaded, 'move-north'), defaults['move-north']);
});

test('a custom storage key keeps keybindings separate from other slices', async () => {
  const storage = createFakeStorage();
  const keymap = createKeymap({ confirm: [{ device: 'key', code: 'Enter' }] });

  await saveKeybindings(storage, keymap, 'player-1-keybindings');
  const loadedUnderDefaultKey = await loadKeybindings(storage, {});
  const loadedUnderCustomKey = await loadKeybindings(storage, {}, 'player-1-keybindings');

  assert.deepEqual(bindingsFor(loadedUnderDefaultKey, 'confirm'), []);
  assert.deepEqual(bindingsFor(loadedUnderCustomKey, 'confirm'), [{ device: 'key', code: 'Enter' }]);
});
