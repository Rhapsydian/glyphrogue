# Glyphrogue

A web-based game engine for ASCII/glyph-driven roguelikes, in the spirit of
*Caves of Qud*. Monospace/pixel-font glyph rendering, a full dev-time
toolchain (map editor, tileset tools, scripting console) that stays out of
production builds, and support for static HTML, GitHub Pages, itch.io, and a
Steam-compatible Electron desktop build.

The research & planning phase is complete, and **`packages/core`
implementation is underway**: sessions 14-17 of the roadmap are done —
npm-workspaces scaffolding, a purpose-built ECS (entity/component) layer,
the generic registration mechanism, the action/rule dispatch pipeline
(additive and priority-based exclusive resolution), the time-units
scheduler, the engine loop (`lock`/`unlock`/`act`/`run`) with `TakeTurn`
dispatch for non-player actors, and — as of session 17 — the public
`createApi()` surface every consumer goes through, versioned save DTOs with
a stepwise migration mechanism, a storage backend abstraction
(memory/localStorage/filesystem, atomic writes), a no-op-default `platform`
capability, and headless/deterministic testability (seeded RNG, a
`node --test`-friendly save/load/continue loop with no timers involved).
60 `node --test` cases passing. See:

- [`DESIGN.md`](./DESIGN.md) — architecture decisions made so far
- [`BACKLOG.md`](./BACKLOG.md) — the roadmap and what's next (session 18)
- [`docs/design/`](./docs/design/) — in-depth design docs, one per topic
- [`docs/data-model.md`](./docs/data-model.md) — living reference for actual data shapes, kept current alongside implementation
- [`docs/session-logs/`](./docs/session-logs/) — one entry per session, goal/decisions/work/deferred items

## Layout

```
packages/
  core/     the runtime engine — implementation started (session 14): world.js, registry.js,
            actions.js, scheduler.js, engine.js, api.js, save.js, storage.js, rng.js under
            src/, tests under test/
  editor/   dev-time tools (map editor, tileset editor, scripting console) — not started, never ships in production
  cli/      create-glyphrogue-game scaffolding tool — not started
docs/design/  in-depth design docs, one per deep-dive planning session
docs/session-logs/  one log per session
```
