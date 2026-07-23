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

## Status

Harness foundation in progress (design roadmap item 2). `mountEditor`
currently mounts a placeholder shell — no tools are wired in yet.
