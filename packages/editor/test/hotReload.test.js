import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, createMemoryStorage } from '@glyphrogue/core';
import { snapshotWorld, restoreWorldFromSnapshot } from '../src/hotReload.js';

test('snapshotWorld saves a restorable snapshot of the live world', async () => {
  const api = createApi();
  const storage = createMemoryStorage();

  await snapshotWorld(api, storage, 'hotreload-key');

  const saved = await storage.load('hotreload-key');
  assert.ok(saved);
  assert.equal(saved.coreSchemaVersion, 1);
});

test('restoreWorldFromSnapshot returns undefined for a cold start with no snapshot', async () => {
  const storage = createMemoryStorage();
  assert.equal(await restoreWorldFromSnapshot(storage, 'missing-key'), undefined);
});

test('restoreWorldFromSnapshot round-trips live world state through a snapshot', async () => {
  const api = createApi();
  const entity = api.createEntity();
  api.addComponent(entity, 'Position', { x: 7, y: 9 });

  const storage = createMemoryStorage();
  await snapshotWorld(api, storage, 'hotreload-key');

  const restored = await restoreWorldFromSnapshot(storage, 'hotreload-key');

  assert.ok(restored);
  assert.deepEqual(restored.getComponent(entity, 'Position'), { x: 7, y: 9 });
});
