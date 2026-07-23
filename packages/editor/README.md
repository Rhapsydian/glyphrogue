# @glyphrogue/editor

Dev-time companion tooling: map editor, tileset/calibration editor, content
browser, composition wizard, config UI, and the hot-reload dev harness they
all mount inside. `@glyphrogue/core` is a `peerDependency` — the editor
operates on whatever live `api`/world the consuming game already built,
never constructing its own instance. Never imported by a game's production
build.

Authored in Svelte 5, compiled ahead of time — `dist/` (built via `npm run
build`) is the only thing published; `.svelte` source and the Svelte
compiler are dev-time only. See `../../docs/design/editor.md` for the full
design and `../../BACKLOG.md`'s "packages/editor design roadmap" for
implementation sequencing.

## Usage

```js
import { mountEditor } from '@glyphrogue/editor';

mountEditor(document.getElementById('editor-root'), api);
```

Hot-reload state preservation and the shared file-write API are separate,
opt-in pieces a consuming game's own dev bootstrap/vite.config.js wires up
(see `../../docs/design/editor.md`'s "hot-reload dev harness" and "shared
file-write API" sections):

```js
// dev bootstrap (alongside mountEditor above)
import { snapshotWorld, restoreWorldFromSnapshot } from '@glyphrogue/editor/hotReload';

// vite.config.js
import { createFileWriteApi } from '@glyphrogue/editor/devServerPlugin';
export default {
  plugins: [createFileWriteApi({ projectRoot: __dirname })],
};
```

## Status

Harness foundation complete (design roadmap item 2, session 29): package
scaffold + Svelte build step, a `dev/` fixture, hot-reload world
snapshot/restore, the shared file-write API, and a touched-files log
(`App.svelte`'s current panel — the harness's first real end-to-end
feature). Individual tools (map editor, content browser, composition
wizard, tileset/calibration editor, config UI, plugin management) are not
yet started — see `../../BACKLOG.md`'s "packages/editor design roadmap".
