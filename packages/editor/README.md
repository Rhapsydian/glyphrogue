# @glyphrogue/editor

Dev-time companion tooling: map editor, tileset/calibration editor, content
browser, behavior wizard, config UI, and the hot-reload dev harness they
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

Harness foundation (item 2, session 29), plugin management (item 3,
session 32), shared UI infrastructure (item 4, session 33), the map
editor's standalone-authoring scope (item 5, session 34), the generator
composition tool (item 6, session 36), the content browser (item 7,
session 37), the behavior wizard (item 8, session 38), and the tileset/
font-calibration editor (item 9, session 39) are all complete. Map editor
in-context editing/override export (deferred out of item 5 —
`packages/core` has no "current zone" concept to build it against yet) and
the remaining tool, config UI (item 10), haven't started — see
`../../BACKLOG.md`'s "packages/editor design roadmap".
