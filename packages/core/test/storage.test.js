import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryStorage, createLocalStorageBackend, createFsStorage, writeFileAtomic } from '../src/storage.js';

test('createMemoryStorage round-trips a save DTO', async () => {
  const storage = createMemoryStorage();
  const dto = { coreSchemaVersion: 1, core: { entities: [1, 2] } };

  await storage.save('slot1', dto);
  const loaded = await storage.load('slot1');

  assert.deepEqual(loaded, dto);
  assert.equal(await storage.load('missing'), undefined);
});

test('createMemoryStorage stores an independent copy, not a live reference', async () => {
  const storage = createMemoryStorage();
  const dto = { entities: [1] };

  await storage.save('slot1', dto);
  dto.entities.push(2);

  const loaded = await storage.load('slot1');
  assert.deepEqual(loaded.entities, [1]);
});

function createFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
}

test('createLocalStorageBackend round-trips a save DTO through a fake storage object', async () => {
  const storage = createLocalStorageBackend(createFakeLocalStorage());
  const dto = { coreSchemaVersion: 1, core: { entities: [1, 2] } };

  await storage.save('slot1', dto);
  const loaded = await storage.load('slot1');

  assert.deepEqual(loaded, dto);
});

test('createLocalStorageBackend returns undefined for a missing key', async () => {
  const storage = createLocalStorageBackend(createFakeLocalStorage());
  assert.equal(await storage.load('missing'), undefined);
});

test('createFsStorage round-trips a save DTO through a real temp directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'glyphrogue-save-'));
  try {
    const storage = createFsStorage(dir);
    const dto = { coreSchemaVersion: 1, core: { entities: [1, 2] } };

    await storage.save('slot1', dto);
    const loaded = await storage.load('slot1');

    assert.deepEqual(loaded, dto);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('createFsStorage returns undefined for a missing key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'glyphrogue-save-'));
  try {
    const storage = createFsStorage(dir);
    assert.equal(await storage.load('missing'), undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('createFsStorage creates its base directory on first save', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'glyphrogue-save-'));
  try {
    const nested = join(parent, 'nested', 'saves');
    const storage = createFsStorage(nested);

    await storage.save('slot1', { ok: true });

    assert.deepEqual(await storage.load('slot1'), { ok: true });
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('createFsStorage writes atomically: a failed save leaves the existing save untouched, with no leftover temp file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'glyphrogue-save-'));
  try {
    const storage = createFsStorage(dir);

    await storage.save('slot1', { a: 1 });

    // BigInt can't be JSON.stringify'd - stringify throws before any
    // filesystem write happens, so the existing save must be untouched.
    await assert.rejects(() => storage.save('slot1', { bad: 10n }));

    const stillThere = await storage.load('slot1');
    assert.deepEqual(stillThere, { a: 1 });

    const files = await readdir(dir);
    assert.ok(!files.some((f) => f.endsWith('.tmp')), `expected no leftover temp file, found: ${files}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('createFsStorage overwrite replaces the prior save with no leftover temp file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'glyphrogue-save-'));
  try {
    const storage = createFsStorage(dir);

    await storage.save('slot1', { a: 1 });
    await storage.save('slot1', { a: 2 });

    assert.deepEqual(await storage.load('slot1'), { a: 2 });

    const files = await readdir(dir);
    assert.ok(!files.some((f) => f.endsWith('.tmp')), `expected no leftover temp file, found: ${files}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeFileAtomic writes arbitrary text content to an arbitrary path, creating parent directories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'glyphrogue-write-'));
  try {
    const target = join(dir, 'nested', 'zone1.json');
    await writeFileAtomic(target, '{"cells":[]}');

    const { readFile } = await import('node:fs/promises');
    assert.equal(await readFile(target, 'utf8'), '{"cells":[]}');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeFileAtomic overwrite leaves no leftover temp file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'glyphrogue-write-'));
  try {
    const target = join(dir, 'file.txt');
    await writeFileAtomic(target, 'first');
    await writeFileAtomic(target, 'second');

    const { readFile } = await import('node:fs/promises');
    assert.equal(await readFile(target, 'utf8'), 'second');

    const files = await readdir(dir);
    assert.ok(!files.some((f) => f.endsWith('.tmp')), `expected no leftover temp file, found: ${files}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
