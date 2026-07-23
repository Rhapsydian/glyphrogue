# Build pipeline & dev/prod split

Deep-dive design doc for Glyphrogue's monorepo tooling, the core/editor
package split, the asset pipeline, and downstream game scaffolding.
Produced in the session-8 planning pass (see `BACKLOG.md` for the roadmap
this fits into). Treat this as the source of truth for the topics below —
`DESIGN.md` will be trimmed to a short summary linking here, same pattern as
the five prior docs.

This doc also corrects two places where `DESIGN.md`'s framing didn't
survive contact with what's actually on disk, the same way
`fonts-and-tilesets.md` refined `rendering.md`'s single-font assumption.

## Correcting the pixelloom/pixelyph precedent

`DESIGN.md`'s "Repo structure" section calls Glyphrogue "an npm-workspaces
monorepo, following the pattern already validated in `pixelloom` →
`pixelyph`." Checking the actual repos: `pixelloom` is a standalone package
published to the npm registry (`pixelloom@0.1.1`), and `pixelyph` depends on
it as an ordinary `dependencies` entry. There is no `workspaces` field in
either `package.json`, and no single repo containing both — they're two
separate repos with an ordinary publish/consume relationship.

**What that pair actually validates** is the *architectural* split — a
small, dependency-light, `sideEffects: false` core wrapped by a larger app —
and the custom-Vite-mode pattern (`pixelyph`'s `build:itch` script running
`vite build --mode itch`, switching `base` between `/` and `./`). It does
not validate npm workspaces as a mechanism, because it never uses them.

**Decision**: Glyphrogue still uses real npm workspaces
(`"workspaces": ["packages/*"]` in a root `package.json`), but as a new
choice made for a reason specific to this project, not as something
`pixelloom`/`pixelyph` already proved out: `core`, `editor`, and `cli` need
to be developed in lockstep pre-1.0 (an editor change and the core API it
previews often land together), which is exactly the case workspaces exist
for — symlinked local resolution instead of publish-and-bump on every
change. `pixelloom` didn't need this because its public API was already
stable relative to `pixelyph` by the time that dependency existed.

**Workspaces don't threaten the packages' independence, with one
guardrail.** Workspaces are purely a dev-time resolution mechanism — inside
the monorepo, `@glyphrogue/editor`'s dependency on `@glyphrogue/core`
symlinks to `packages/core` instead of installing a published version. That
doesn't change what a downstream consumer sees (still two ordinary
published packages), and it doesn't force lockstep versioning (see below).
The real risk is that symlinked resolution makes it easy for `editor` to
get sloppy — reaching into `packages/core/src/whatever.js` by relative path
instead of importing `@glyphrogue/core` by package name. That works fine
inside the monorepo (it's all local files) but would silently break the
moment someone consumes the *published* `@glyphrogue/core`, since only what
its `exports` field exposes actually resolves outside the workspace.
**Decision: `editor` (and `cli`) only ever import `@glyphrogue/core` by
package name, never by relative path across the package boundary** — this
keeps workspace-resolved dev identical in shape to what a real external
consumer gets, so "independent package" stays true in practice.

**Versioning policy: independent, not lockstep.** Each package keeps its
own semver, bumped only when it actually changes, rather than all three
moving together on every release. This is the option consistent with why
`core`/`editor` are two packages at all (previous section) — lockstep
versioning would mean a game depending only on `core` sees version bumps
that correspond to nothing it actually uses, which undercuts the point of
splitting them. The trade-off is more bookkeeping (something has to decide,
per release, which packages actually changed, and `editor`'s dependency
range on `core` has to be kept honest rather than assumed-compatible by
matching numbers) — accepted as worth it here. The specific mechanism
(manual bump discipline vs. a tool like Changesets) is left as an
implementation-time detail below, since nothing is published yet.

## Package structure: two packages, not one with subpaths

`DESIGN.md`'s "Dev/prod code splitting" section describes the mechanism as
subpath exports of a single package — `glyphrogue/runtime` vs.
`glyphrogue/editor`. But the packages were scaffolded (session 1) as two
independent directories, each with its own placeholder README describing
itself as its own package: `@glyphrogue/core` and `@glyphrogue/editor`.
`packages/cli`'s README already describes the scaffolded game getting
"core + editor" in dev and "core only" in prod — two packages, not one
package with a conditional export.

**Decision: two separate scoped npm packages**, `@glyphrogue/core` and
`@glyphrogue/editor` (plus `@glyphrogue/cli`, unpublished — see the
scaffolding section below), matching what's already on disk. This is a
strictly stronger structural guarantee than subpath exports of one package
would have been: a production bundler resolving a game's dependency graph
never sees `@glyphrogue/editor` at all if nothing imports it, versus one
package with an `exports` map the bundler still has to parse and decide not
to use. It also lets `core` and `editor` version and release independently
once they're both stable — `editor` iterating faster without forcing a
`core` version bump, which a single package with internal subpaths
couldn't do. `DESIGN.md`'s "Dev/prod code splitting" section gets updated to
describe two packages rather than one package's subpaths.

`@glyphrogue/core` doesn't need any further internal subpath split beyond
its one entry point — nothing decided in sessions 1–7 calls for a
partial-import surface (e.g. importing just the ECS layer without
rendering), and inventing one now would be speculative.

## Shipping the packages: no build step

`pixelyph`'s `vite.config.js` only demonstrates an **application** build —
one `index.html` entry, `base` switched per mode. `@glyphrogue/core` and
`@glyphrogue/editor` are **libraries** other repos consume, which nothing in
`pixelyph` is a precedent for. The naive approach — give each package its
own Vite library-mode build (`build.lib`, a compiled `dist/`) — turns out to
be unnecessary once you look at how `pixelloom` actually ships itself.

**What `pixelloom` does**: no build step at all. Its `package.json` is
`"exports": { ".": "./src/index.js" }`, `"files": ["src"]`,
`"sideEffects": false`, plain `.js` source, no `dist/`, no bundler in its
own `scripts`. It ships raw ES modules and lets whatever consumes it
(`pixelyph`'s own Vite build) do the bundling. And per `mapgen-and-editor.md`
and `scripting-api.md`, Glyphrogue's own project isn't TypeScript either —
`pixelyph`/`pixelloom`'s source is plain `.js`/`.jsx` (its `typescript`
devDependency is unused by any build script), and `DESIGN.md`'s testing
section already committed to `node --test` with no framework, consistent
with a plain-JS, low-ceremony project rather than a compiled one.

**Decision**: `@glyphrogue/core` and `@glyphrogue/editor` ship the same
way — raw ESM `src/`, `sideEffects: false`, an `exports` map pointing
straight at source, no compile/bundle step of their own. This has two
compounding benefits specific to this project: it removes the
library-mode-Vite and `.d.ts`-generation questions entirely (there's no
TypeScript to emit declarations for), and inside the workspace it means
`editor`'s dev server resolves `@glyphrogue/core` straight to source with no
rebuild-and-relink step between editing core and seeing it live in the
editor — workspaces already symlink `node_modules/@glyphrogue/core` to
`packages/core`, so this falls out for free rather than needing its own
watch/rebuild tooling.

## Asset pipeline: fonts are the only real "asset" problem

The backlog scope names three asset kinds — fonts, maps, data files — but
they don't actually need the same treatment, and conflating them was going
to lead to overbuilding a pipeline the other two don't need.

**Maps and data files are code, not assets.** `scripting-api.md` already
decided first-party content (which includes hand-authored `ZoneDTO`
templates, per `mapgen-and-editor.md`'s "Templates" section) is "statically
imported at build time" as ordinary modules — `register(api)` calls in JS
files, or JSON imported like any other data. `mapgen-and-editor.md`'s save
strategy is seed+params+diff, not a shipped grid file, so generated zones
don't exist as build-time assets at all — they're computed at runtime from
a tiny params object. Tileset/palette/keybinding config
(`fonts-and-tilesets.md`, `ui-and-input.md`) is likewise author-written
data a game imports normally. None of this needs a dedicated asset
pipeline, dev/prod divergence, or a `public/` directory — it's just source
files, and Vite's normal JS/JSON handling (including `import()` for lazy-
loading a large zone template without it bloating the main bundle) already
covers it. Large hand-authored world data is a real future concern but
isn't a build-*pipeline* question — it's a content-authoring-scale question
for whenever a game actually hits it.

**Fonts are the one genuine static-asset case.** Pixelyph exports real
binary files — OTF, WOFF/WOFF2, plus the JSON glyph manifest
(`fonts-and-tilesets.md`) — which are binary/generated artifacts, not
source a game authors by hand. **Decision**: a game's font files live under
its own `assets/fonts/` (or similar) and get imported the way Vite handles
any static binary asset — `import fontUrl from './assets/fonts/x.woff2?url'`
for the font file feeding an `@font-face` rule, plain `import manifest from
'./assets/fonts/x.manifest.json'` for the JSON metadata (JSON is cheap
enough to inline into the bundle; it's not binary). This works identically
in dev and prod — Vite serves it from memory in dev, copies/hashes it into
the output in prod — so there's no dev/prod divergence to design here
either, unlike the code-split question below. The only mode-sensitive part
is base-path resolution (relative `./` for itch.io/Electron vs. root `/`
for the GitHub Pages custom domain), which is already solved generally by
the `base` switch in the next section — fonts don't need their own case of
it.

## Dev/prod split mechanics in a downstream game

This concretizes `DESIGN.md`'s existing decision ("structural separation
via package subpath exports... rather than relying on a bundler to notice
it's unused") now that the mechanism is two packages, not one.

**Decision: separate entry points, not a runtime flag.** A scaffolded
game gets two HTML entries — `index.html` (the shipped game, imports only
`@glyphrogue/core`) and `dev.html` (imports `@glyphrogue/core` *and*
`@glyphrogue/editor`, mounts the editor's hot-reload harness around the
game view). `vite.config.js`'s `build.rollupOptions.input` for a production
build (`vite build`) lists only `index.html`; the dev server
(`vite --open dev.html`, or a `dev` script that opens it directly) serves
both. This is what makes the separation structural rather than a
tree-shaking bet: `@glyphrogue/editor` is not merely unreferenced dead code
in a prod build's module graph, it's a package no file reachable from
`index.html`'s entry ever imports, so it can't leak in even if a future
refactor accidentally adds a stray import somewhere under `src/` — only a
file reachable from `dev.html` could do that, and nothing under
`dev.html`'s graph ships.

`base` follows the same per-mode switch `pixelyph` already established
(`base: mode === 'itch' ? './' : '/'`), extended with the same relative-path
value for the Electron renderer build, per `electron.vite.config.mjs`'s
existing `base: './'` — three deploy targets (GitHub Pages, itch.io,
Electron) collapsing to two `base` values (root vs. relative), decided once
per target the way `pixelyph` already does it, not a new axis this doc
introduces.

## `create-glyphrogue-game` scaffolding

`packages/cli`'s placeholder README already states its job: "wires up a
Vite config with dev mode (core + editor) and production mode (core only)"
— the mechanics above are exactly what it needs to generate.

**Decision**: a standard `npm create glyphrogue-game` /
`create-*`-package — npm's convention for `npm create <x>` resolving to a
`create-<x>` package's bin, so no custom global-install story is needed. Kept
deliberately plain given the project's low-ceremony convention (no
templating framework): a `templates/default/` directory inside
`packages/cli` holding a ready-to-run scaffold (the two-entry
`vite.config.js`/`index.html`/`dev.html` from above, a starter
`package.json` with `@glyphrogue/core` in `dependencies` and
`@glyphrogue/editor` in `devDependencies`, and starter content folders —
`src/maps/`, `src/plugins/` (each plugin its own `src/plugins/<pluginId>/`
folder per `docs/design/editor.md`'s plugin-management design),
`assets/fonts/` — each with one minimal working
example, not empty), copied into the target directory with a small number
of string substitutions (game name into `package.json`, into `index.html`'s
`<title>`). A downstream game is its own repo, not a workspace member of
`glyphrogue` itself — same relationship `pixelyph` has to `pixelloom` — so
the scaffold's `package.json` depends on the **published**
`@glyphrogue/core`/`@glyphrogue/editor`, not a workspace-protocol reference.

## Open items carried forward

- **Release/versioning mechanism** — the "independent, not lockstep"
  versioning policy above is decided; the actual mechanism (manual bump
  discipline vs. a tool like Changesets) is implementation-time detail,
  deferred until there's an actual first release to cut.
- **Scaffold template content specifics** — the exact starter example
  under each content folder (what the one example map/plugin/font looks like)
  is implementation-time detail, not a planning-pass decision, same
  treatment `fonts-and-tilesets.md` gave the calibration-derivation formula.
- **Electron/Steam packaging** — explicitly out of scope, carried to session
  9 (`packaging.md`, planned). This doc's job was to produce the build
  *artifact* boundary that session consumes (a `vite build` output
  directory, `base: './'` already handled) — not to design
  `electron-builder`/`steamworks.js` integration itself, which `DESIGN.md`'s
  existing "Build targets" section already scoped there.
- **Large hand-authored world data at scale** — flagged above: fine as
  ordinary code-imported/lazy-imported data for anything built so far, but
  a game with a very large hand-authored world may eventually want a real
  content-pipeline story (e.g. a build step that splits one big authoring
  file into many lazy-loadable chunks). Not needed by anything decided in
  sessions 1–8; deferred until a concrete case demands it, per `BACKLOG.md`'s
  "Deferred / future items" convention.
