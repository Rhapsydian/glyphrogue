// One interface - { save(key, data): Promise<void>, load(key): Promise<data|undefined> }
// - three implementations. Selection is purely per-build-target
// (packaging.md): localStorage for static/Pages/itch, filesystem for
// Electron, memory for tests/headless use. No Steam-specific branching -
// Steam Cloud is a Steamworks-dashboard config step that watches the
// filesystem backend's own directory, not a fourth backend.

export function createMemoryStorage() {
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

// Takes the storage object as a parameter rather than reading
// globalThis.localStorage directly inside the calls, so this is fully
// testable under `node --test` (no DOM) by passing a small fake
// {getItem, setItem}-shaped object.
export function createLocalStorageBackend(storageLike = globalThis.localStorage) {
  return {
    async save(key, data) {
      storageLike.setItem(key, JSON.stringify(data));
    },
    async load(key) {
      const raw = storageLike.getItem(key);
      return raw == null ? undefined : JSON.parse(raw);
    },
  };
}

// Atomic temp-file-then-rename write of arbitrary text content to an
// arbitrary path, so a crash mid-write never corrupts whatever was there
// before. Shared by createFsStorage's own save() below and by
// packages/editor's shared file-write API (editor.md) - the latter writes
// caller-supplied file content to a caller-supplied project path, not a
// `{baseDir}/{key}.json`-shaped save slot, so it needs this primitive
// directly rather than createFsStorage's higher-level, JSON-slot-specific
// interface.
//
// node:fs/promises and node:path are imported dynamically, inside the
// function itself, rather than statically at module top level.
// `storage.js` is reached by any browser build through `core`'s index.js
// barrel (createMemoryStorage/createLocalStorageBackend are the
// browser-relevant exports here) - a static top-level import of a Node
// builtin trips bundlers' browser-externalization the moment this module
// is merely imported, before this (Electron/dev-server only, per
// packaging.md/editor.md) is ever called.
export async function writeFileAtomic(path, contents) {
  const { mkdir, writeFile, rename } = await import('node:fs/promises');
  const { dirname } = await import('node:path');

  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, contents, 'utf8');
  await rename(tmpPath, path);
}

// Electron's filesystem backend (packaging.md).
export function createFsStorage(baseDir) {
  return {
    async save(key, data) {
      const { join } = await import('node:path');

      // JSON.stringify runs before any filesystem write, so a value that
      // can't be serialized (e.g. a BigInt) throws here and never touches
      // disk - the existing save stays exactly as it was.
      const contents = JSON.stringify(data);
      await writeFileAtomic(join(baseDir, `${key}.json`), contents);
    },
    async load(key) {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      try {
        return JSON.parse(await readFile(join(baseDir, `${key}.json`), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
  };
}
