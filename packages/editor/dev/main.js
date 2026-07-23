import { unmount } from 'svelte';
import {
  createApi,
  createLocalStorageBackend,
  loadPlugins,
  bspPlugin,
  cellularAutomataPlugin,
  wfcPlugin,
  layeredBiomePlugin,
  wandersPlugin,
  chasesPlayerPlugin,
  fleesPlugin,
  guardsPlugin,
  memoryPlugin,
  audioLoaderPlugin,
} from '@glyphrogue/core';
import { mountEditor } from '../src/mount.js';
import { snapshotWorld, restoreWorldFromSnapshot } from '../src/hotReload.js';

// sessionStorage, not localStorage: this snapshot only needs to bridge a
// single Vite HMR cycle within the current tab, not survive an actually
// closed tab the way a real player save (which uses localStorage) should.
const hotReloadStorage = createLocalStorageBackend(sessionStorage);
const HOT_RELOAD_KEY = 'glyphrogue-editor-dev-fixture';

const restored = await restoreWorldFromSnapshot(hotReloadStorage, HOT_RELOAD_KEY);
const api = restored ?? createApi();

// Plugin registrations (rules/generators/services) aren't part of
// serialize/deserialize's round-tripped world data - only entities/
// components are - so this has to run every time this module runs,
// restored or not, not just on a genuine cold start. Gives plugin
// management (editor roadmap item 3) something genuine to discover,
// toggle, and verify against, per BACKLOG.md's reconciliation roadmap.
loadPlugins(api, [
  bspPlugin,
  cellularAutomataPlugin,
  wfcPlugin,
  layeredBiomePlugin,
  wandersPlugin,
  chasesPlayerPlugin,
  fleesPlugin,
  guardsPlugin,
  memoryPlugin,
  audioLoaderPlugin,
]);

// A minimal real game, not a mock - editor.md's harness operates on
// whatever live api/world a consuming game already built, so the fixture
// has to be a genuine createApi() instance for that to actually be
// exercised. Only seed dummy entities on a genuine cold start - a restored
// api already has them (and whatever a developer mutated before the last
// HMR update).
if (!restored) {
  const player = api.createEntity();
  api.addComponent(player, 'Position', { x: 2, y: 3 });

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 5, y: 1 });
  api.addComponent(goblin, 'Wanders', {});
}

// Exposed for manual hot-reload verification only (checking that a
// live-mutated component survives an HMR update) - not part of the
// fixture's own normal operation.
window.__glyphrogueApi = api;

function renderGameFixture(container) {
  const rows = [...api.world.entities].map((entity) => {
    const position = api.getComponent(entity, 'Position');
    return `<li>entity ${entity}: ${JSON.stringify(position)}</li>`;
  });
  container.innerHTML = `
    <h1>Glyphrogue dev fixture</h1>
    <p>Sibling region to the right is the editor harness (editor.md: no
    iframe, no overlay - a plain DOM sibling of the game's own UI).</p>
    <ul>${rows.join('')}</ul>
  `;
}

renderGameFixture(document.getElementById('game'));
const editorInstance = mountEditor(document.getElementById('editor-root'), api);

// Self-accepting: without this, Vite has no HMR boundary for this module
// and falls back to a full page reload on any edit here, which tears
// everything down without ever running dispose logic at all.
import.meta.hot?.accept();

// Vite keeps only the *last* `hot.dispose()` registration per module (a
// single slot, not a queue) - world-snapshotting and unmounting the
// previous editor instance both have to happen from this one combined
// callback, not two separate `hot.dispose()` calls, or the second
// registration would silently clobber the first.
import.meta.hot?.dispose(async () => {
  unmount(editorInstance);
  await snapshotWorld(api, hotReloadStorage, HOT_RELOAD_KEY);
});
