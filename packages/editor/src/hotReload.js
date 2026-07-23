import { serialize, deserialize } from '@glyphrogue/core';

// Pure save/restore helpers, deliberately with no `import.meta.hot`
// involvement of their own - editor.md: "No new mechanism ... wires an
// existing, already-tested one to a new trigger point", reusing core's
// serialize/deserialize + a storage backend exactly as save/load already
// does. Vite only keeps the *last* `hot.dispose()` registration per
// module (it's a single slot, not a queue) - a caller that also needs to
// tear down other things on dispose (e.g. unmounting the editor's own
// Svelte instance) must combine everything into one `hot.dispose()` call
// itself; these helpers stay hot-agnostic so they compose into that call
// rather than fighting over the one slot.
export function snapshotWorld(api, storage, key, serializeOptions) {
  return storage.save(key, serialize(api, serializeOptions));
}

// Returns a restored `api` if a snapshot exists, or undefined for a
// genuine cold start - the caller decides between this and its normal
// createApi() based on which comes back, same shape session 17's
// save/load call sites use.
export async function restoreWorldFromSnapshot(storage, key, deserializeOptions) {
  const snapshot = await storage.load(key);
  return snapshot ? deserialize(snapshot, deserializeOptions) : undefined;
}
