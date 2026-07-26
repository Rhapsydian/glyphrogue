import { unmount } from 'svelte';
import { createApi, createLocalStorageBackend } from '@glyphrogue/core';
import { mountEditor } from '@glyphrogue/editor';
import { snapshotWorld, restoreWorldFromSnapshot } from '@glyphrogue/editor/hotReload';
import { registerPlugins } from '../bootstrap.js';
import { instantiateZoneContent, renderZone } from './game.js';

// sessionStorage, not localStorage: this snapshot only needs to bridge a
// single Vite HMR cycle within the current tab, not survive an actually
// closed tab the way a real player save (localStorage) should.
const hotReloadStorage = createLocalStorageBackend(sessionStorage);
const HOT_RELOAD_KEY = 'glyphrogue-dev-fixture';

const restored = await restoreWorldFromSnapshot(hotReloadStorage, HOT_RELOAD_KEY);
const api = restored ?? createApi();

// Plugin registrations aren't part of serialize/deserialize's round-tripped
// world data, so this has to run every time, restored or not.
registerPlugins(api);

// Only seed the starter content on a genuine cold start - a restored api
// already has it (and whatever got mutated before the last HMR update).
if (!restored) {
  instantiateZoneContent(api);
}

renderZone(document.getElementById('game'));
const editorInstance = mountEditor(document.getElementById('editor-root'), api);

// Self-accepting: without this, Vite has no HMR boundary for this module
// and falls back to a full page reload, which tears everything down
// without ever running dispose logic at all.
import.meta.hot?.accept();

// Vite keeps only the *last* hot.dispose() registration per module (a
// single slot, not a queue) - world-snapshotting and unmounting the
// previous editor instance both have to happen from this one combined
// callback.
import.meta.hot?.dispose(async () => {
  unmount(editorInstance);
  await snapshotWorld(api, hotReloadStorage, HOT_RELOAD_KEY);
});
