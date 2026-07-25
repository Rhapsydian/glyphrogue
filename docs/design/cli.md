# packages/cli: create-glyphrogue-game scaffolding

Deep-dive design doc for `packages/cli` — the `npm create glyphrogue-game`
scaffolding CLI that bootstraps a new downstream game project. Produced in
the session-41 planning pass (see `BACKLOG.md` for the roadmap this fits
into). Treat this as the source of truth for the topics below, same
pattern as the other `docs/design/` entries.

**Scope note**: this doc covers the web scaffold only — the dev
(core+editor)/prod (core-only) Vite wiring `packages/cli`'s own
placeholder README already describes, GitHub Pages, and itch.io.
`packaging.md`'s Electron/Steam material (IPC surface, code signing,
update strategy, Steam build/upload) is real and already well-designed,
but it's deliberately left out of this pass rather than folded in — no
downstream game exists yet to need desktop/Steam distribution, and that
material isn't a consolidation gap the way the web scaffold was. See
`BACKLOG.md`'s deferred items for the follow-up session this becomes once
there's a concrete need.

This doc consolidates decisions already made in `build-pipeline.md`'s
"`create-glyphrogue-game` scaffolding" section and `packaging.md`'s
GitHub Pages/itch.io deploy-mechanics section — restated here as the
single source of truth for `packages/cli`, cross-referenced rather than
duplicated where the original reasoning lives elsewhere — plus new
decisions from this session's live discussion.

## Already decided elsewhere, restated here

- **Package convention**: a standard `npm create glyphrogue-game` /
  `create-glyphrogue-game` package, npm's built-in convention for
  resolving `npm create <x>` to a `create-<x>` package's bin — no custom
  global-install story needed (`build-pipeline.md`).
- **No templating framework**: `templates/default/` is a plain,
  ready-to-run scaffold directory inside `packages/cli`, copied into the
  target directory — not generated from a templating engine
  (`build-pipeline.md`, and see "Substitution mechanism" below for the
  specific technique this session resolved).
- **Two-entry Vite config**: dev mode loads core+editor, prod mode loads
  core only — the actual build-artifact mechanics (the `base: './'`
  switch, output directory shape) are fixed in `build-pipeline.md`'s
  earlier sections; this doc doesn't re-derive them, only notes that the
  scaffold's `vite.config.js`/`index.html`/`dev.html` are exactly that
  mechanism, generated once at scaffold time.
- **Starter `package.json`**: `@glyphrogue/core` in `dependencies`,
  `@glyphrogue/editor` in `devDependencies` — see "The pre-publish
  problem" below for what version range this actually resolves to today.
- **Starter content folders**, each shipping one minimal working example
  (see "Starter example bar" below for what "minimal" means):
  `src/maps/` (`templates/`, `presets/`, `overrides/<zoneId>.json`, per
  `editor.md`'s map editor file conventions), `src/plugins/<pluginId>/`
  (one folder per plugin, per `editor.md`'s plugin-management convention),
  `assets/fonts/`.
- **Separate-repo target**: a scaffolded game is its own repo, not a
  workspace member of `glyphrogue` itself (same relationship `pixelyph`
  has to `pixelloom`) — so the scaffold's `package.json` always depends on
  published packages, never a workspace-protocol reference.
- **GitHub Pages**: the scaffold ships a working `deploy-pages.yml`,
  baked from `pixelyph`'s existing workflow verbatim — credential-free
  (`actions/configure-pages` + `actions/deploy-pages`), so Pages hosting
  works the moment a repo has Pages enabled, no setup step
  (`packaging.md`).
- **itch.io**: documented, not scripted — the scaffold's README includes
  the `butler push` command with a placeholder channel name, since
  `BUTLER_API_KEY` and the per-project channel are things a template
  can't fill in safely (`packaging.md`).

## The pre-publish problem

`@glyphrogue/core` and `@glyphrogue/editor` have never been published to
npm — `build-pipeline.md`'s "published packages" assumption predates
`packages/cli` having a real implementation session scoped, and
`BACKLOG.md` already defers the release/versioning *mechanism* as
implementation-time detail. That leaves a real gap: what does the
scaffold's generated `package.json` actually contain before a first
release exists?

**Decision**: the scaffold writes real semver ranges (e.g. `^0.1.0`)
against the eventual published package names, exactly as if they already
existed on npm — never a `file:`/`link:` workspace reference. A
workspace-protocol reference would only resolve for someone developing
inside the `glyphrogue` monorepo itself, which contradicts the
already-decided separate-repo relationship above; it would work for our
own testing and be silently broken for every real user of the CLI. This
keeps the CLI's own scaffold-generation logic simple (one code path, not
a dev/prod-published branch) and localizes the actual bootstrapping need
to one place: `@glyphrogue/core` and `@glyphrogue/editor` need a real
`npm publish` at `0.1.0` before the CLI is usable end-to-end.

**Publish early, under `0.x`, not once "polished."** `0.x` is npm/semver's
built-in signal for "no stability promises yet," which honestly reflects
where `core`/`editor` are — still gaining roadmap items every session,
with no fixed finish line "polished" could mean. Waiting for one would
block the CLI from ever being testable against something real; publishing
early costs only the minor churn of re-publishing on breaking changes,
which is exactly what `0.x` exists to absorb. This first publish is a
manual, one-time step that belongs at `packages/cli` **implementation**
time (not this design session) — tracked as a prerequisite in
`BACKLOG.md`'s pointer to that session. For our own local testing of the
scaffold before that first publish exists, `npm link` or manually patching
a generated `package.json` is a testing-time workaround, not something
the CLI itself needs to special-case.

## CLI invocation shape

**Decision**: prompt for exactly one thing — the game name — with the
target directory defaulting to a kebab-cased version of that name in the
current working directory, matching the familiar `create-vite`-style
convention. No non-interactive/flag-driven mode for now: nothing in the
roadmap currently needs scripted/CI-driven scaffolding (a human runs this
once, by hand, to start a new game), and this project's low-ceremony
convention already avoids building machinery ahead of a concrete need —
same reasoning `packaging.md` used to skip `electron-updater` for v1. A
non-interactive mode is small, additive surface if a concrete need (e.g.
a project-generator test harness) shows up later, not a rewrite.

## Starter example bar

`build-pipeline.md` already defers the *exact* content of each starter
example as implementation-time detail, not a planning decision — this
section sets the bar implementation should hit without nailing down
literal file contents.

**Decision**: each starter example demonstrates the *simplest correct
path* through its own package's system, not an advanced feature —

- `src/maps/templates/` — one small hand-placed static room, not a
  generator call. Generators are an editor-authoring concern (the map
  editor's job); a fresh scaffold shouldn't require understanding
  generator params to have a playable starting zone.
- `src/plugins/<pluginId>/` — one minimal plugin registering a single
  trivial thing (e.g. one entity type), per `editor.md`'s plugin folder
  convention.
- `assets/fonts/` — one working font source, already calibrated. Font
  calibration has its own dedicated editor tool (`packages/editor` design
  roadmap item 9); a brand-new scaffold shouldn't ask an author to tune
  that on day one.

The unifying bar: a fresh scaffold runs and shows something on screen
with zero required edits, but nothing in it should require reading a
design doc to modify.

**Deferred**: richer/more advanced example projects (beyond this
bare-minimum "it runs" bar) are worth long-term backlog attention once
there's appetite to invest in onboarding material — see `BACKLOG.md`'s
deferred items.

## Substitution mechanism

**Decision**: plain literal string replacement against a small, fixed set
of placeholder tokens (e.g. `__GAME_NAME__`) baked directly into the
template files — no templating engine, no `{{mustache}}`-style syntax, no
build step over `templates/default/`. This matches `build-pipeline.md`'s
existing "no templating framework" decision, and the two known
substitution sites (`package.json`'s name, `index.html`'s `<title>`) are
nowhere near the complexity that would justify a dependency — a
`String.prototype.replaceAll` per copied file's contents, keyed off a
small constant map, is the entire implementation. A future third or
fourth substitution site is one more map entry, not a new mechanism.

## Open items carried forward

- **Electron/Steam scaffold generation** — deliberately out of scope this
  session (see the scope note above); `packaging.md`'s IPC/signing/update/
  Steam-upload material is already designed but not yet folded into a CLI
  scaffold-generation story. Needs its own scoped session once a real
  downstream game needs desktop/Steam distribution.
- **First `npm publish` of `@glyphrogue/core`/`@glyphrogue/editor` at
  `0.1.0`** — a manual prerequisite step for `packages/cli`
  implementation, not a design decision; see "The pre-publish problem"
  above.
- **Richer example projects** — the starter-example bar above is
  deliberately minimal; more advanced onboarding examples are long-term
  backlog, not this session's job.
- **Release/versioning mechanism** — still deferred per
  `build-pipeline.md`'s existing open item (manual bump discipline vs. a
  tool like Changesets); the first publish above doesn't require this to
  be resolved, just a version number.
