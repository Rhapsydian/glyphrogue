# Glyphrogue

A web-based game engine for ASCII/glyph-driven roguelikes, in the spirit of
*Caves of Qud*. Monospace/pixel-font glyph rendering, a full dev-time
toolchain (map editor, tileset tools, scripting console) that stays out of
production builds, and support for static HTML, GitHub Pages, itch.io, and a
Steam-compatible Electron desktop build.

This project is currently in the **research & planning phase** — no engine
code exists yet. See:

- [`DESIGN.md`](./DESIGN.md) — architecture decisions made so far
- [`BACKLOG.md`](./BACKLOG.md) — the planning roadmap and what's next
- [`docs/design/`](./docs/design/) — in-depth design docs, one per topic, produced as planning sessions complete

## Layout (planned)

```
packages/
  core/     the runtime engine — ships in every production game
  editor/   dev-time tools (map editor, tileset editor, scripting console) — never ships in production
  cli/      create-glyphrogue-game scaffolding tool
docs/design/  in-depth design docs, one per deep-dive planning session
```
