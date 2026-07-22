import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage } from '../src/storage.js';
import { saveMixSettings, loadMixSettings } from '../src/audioSettings.js';

test('save then load roundtrips mix settings', async () => {
  const storage = createMemoryStorage();
  const settings = { master: 0.8, music: 0.5, sfx: 1 };

  await saveMixSettings(storage, settings);
  const loaded = await loadMixSettings(storage, { master: 1, music: 1, sfx: 1 });

  assert.deepEqual(loaded, settings);
});

test('loading with nothing stored yet falls back to defaults', async () => {
  const storage = createMemoryStorage();
  const defaults = { master: 1, music: 0.7, sfx: 0.7 };

  const loaded = await loadMixSettings(storage, defaults);

  assert.deepEqual(loaded, defaults);
});

test('a custom storage key keeps mix settings separate from other slices', async () => {
  const storage = createMemoryStorage();
  const settings = { master: 0.3, music: 0.3, sfx: 0.3 };

  await saveMixSettings(storage, settings, 'player-1-mix-settings');
  const loadedUnderDefaultKey = await loadMixSettings(storage, { master: 1, music: 1, sfx: 1 });
  const loadedUnderCustomKey = await loadMixSettings(storage, { master: 1, music: 1, sfx: 1 }, 'player-1-mix-settings');

  assert.deepEqual(loadedUnderDefaultKey, { master: 1, music: 1, sfx: 1 });
  assert.deepEqual(loadedUnderCustomKey, settings);
});
