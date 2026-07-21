# Glyphrogue

A web-based game engine for ASCII/glyph-driven roguelikes, in the spirit of
*Caves of Qud*. Monospace/pixel-font glyph rendering, a full dev-time
toolchain (map editor, tileset tools, scripting console) that stays out of
production builds, and support for static HTML, GitHub Pages, itch.io, and a
Steam-compatible Electron desktop build.

The research & planning phase is complete, and **`packages/core`
implementation is underway**: sessions 14-16 of the 12-session roadmap are
done — npm-workspaces scaffolding, a purpose-built ECS (entity/component)
layer, the generic registration mechanism, the action/rule dispatch
pipeline (additive and priority-based exclusive resolution), the
time-units scheduler, and the engine loop (`lock`/`unlock`/`act`/`run`)
with `TakeTurn` dispatch for non-player actors. 35 `node --test` cases
passing. See:

- [`DESIGN.md`](./DESIGN.md) — architecture decisions made so far
- [`BACKLOG.md`](./BACKLOG.md) — the roadmap and what's next (session 17)
- [`docs/design/`](./docs/design/) — in-depth design docs, one per topic
- [`docs/data-model.md`](./docs/data-model.md) — living reference for actual data shapes, kept current alongside implementation
- [`docs/session-logs/`](./docs/session-logs/) — one entry per session, goal/decisions/work/deferred items

## Layout

```
packages/
  core/     the runtime engine — implementation started (session 14): world.js, registry.js,
            actions.js, scheduler.js, engine.js under src/, tests under test/
  editor/   dev-time tools (map editor, tileset editor, scripting console) — not started, never ships in production
  cli/      create-glyphrogue-game scaffolding tool — not started
docs/design/  in-depth design docs, one per deep-dive planning session
docs/session-logs/  one log per session
```
