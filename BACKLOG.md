# Glyphrogue backlog

## NEXT SESSION

The original 8-topic deep-dive planning roadmap finished at session 9
(packaging). Sessions 10-12 added three more planning passes beyond that
original roadmap — custom UI surfaces & interaction hooks, audio, and AI &
behavior (roadmap items 9-11 below) — prompted by gaps found while
reviewing the completed roadmap rather than by pre-planned topics. Per
`docs/design/build-pipeline.md`'s framing, `packages/core` implementation
was waiting on either the roadmap finishing or an explicit decision to
start earlier — the original roadmap and all three follow-on sessions are
now done, so the next `/dev-session` should confirm with the user whether
to start `packages/core` implementation, do another planning pass on one of
the deferred items below, or whether something else takes priority first.
Don't assume implementation starts automatically; this is a decision point,
not a default.

## Deferred / future items

- **Accessible alternative/description layer for the canvas viewport** —
  the canvas game map has no screen-reader-accessible equivalent; flagged
  as a real future addon in `docs/design/ui-and-input.md`'s accessibility
  section, not designed there. Would need its own scoped session.
- **Shipped default colorblind-safe palette** —
  `docs/design/ui-and-input.md` decides palettes must be
  swappable/player-selectable but doesn't ship actual colorblind-safe
  color values (palettes are game-authored content, same as the base
  palette). Providing a default one as a convenience is future work, not
  designed there.
- **Content-pipeline story for large hand-authored world data** —
  `docs/design/build-pipeline.md` decided ordinary code-imported/
  lazy-imported JS/JSON is sufficient for maps/mods/config as designed so
  far, but a game with a very large hand-authored world may eventually
  need a real build step (splitting one big authoring file into many
  lazy-loadable chunks). Not needed by anything decided through session 8;
  would need its own scoped session if a concrete case demands it.
- **Real-time-with-pause battle systems** —
  `docs/design/custom-ui-and-interactions.md` scopes custom battle screens
  to turn-based resolution only; a battle system with its own independent
  real-time clock (rather than the engine's time-units scheduler) is a
  genuinely different primitive, not designed there.
- **Battle-screen-internal AI** — `docs/design/ai-and-behavior.md` covers
  map-level actor decision-making only; a custom battle screen's own
  private opponent logic (per `docs/design/custom-ui-and-interactions.md`'s
  opacity model) remains entirely the screen author's concern, not
  designed in either doc.
- **Zone diff/overlay storage format for mod-defined entity types** —
  `docs/design/mapgen-and-editor.md` expected this to be finalized
  alongside `docs/design/scripting-api.md`'s mod-defined save-slice work;
  checking `scripting-api.md`'s actual save-data section, it never
  specifically addresses zone diffs/overrides carrying mod-defined entity
  types. Genuinely still open, surfaced during the session-13 deep review
  rather than resolved as originally expected.
- **Dev-time tileset/font-calibration editor** —
  `docs/design/fonts-and-tilesets.md` expected this to be UI/UX-session (6)
  territory ("the future tileset editor"); `docs/design/ui-and-input.md`'s
  actual scope (menus, dialogs, keybinding, accessibility, controller
  support) never covered it, and no other session has either. A per-font-
  source calibration override (scale/baseline/centering) currently has no
  authoring UI designed anywhere. Surfaced during the session-13 deep
  review.

## Deep-dive planning roadmap

Implementation of `packages/core` doesn't start until this roadmap (or an
explicit user decision to start earlier) says it's ready to. Each session is
research-and-planning only, producing one doc under `docs/design/`. Order is
roughly dependency order (foundational pieces before things that build on
them; packaging last since it depends on everything else) — reorder/split/
merge as needed if a topic turns out bigger or smaller than expected.

1. ~~**Core architecture & game loop**~~ — done, see
   [`docs/design/core-architecture.md`](docs/design/core-architecture.md).
2. ~~**Rendering system**~~ — done, see
   [`docs/design/rendering.md`](docs/design/rendering.md).
3. ~~**Map generation & map editor**~~ — done, see
   [`docs/design/mapgen-and-editor.md`](docs/design/mapgen-and-editor.md).
4. ~~**Scripting & content/plugin API**~~ — done, see
   [`docs/design/scripting-api.md`](docs/design/scripting-api.md).
5. ~~**Font & glyph/tileset pipeline**~~ — done, see
   [`docs/design/fonts-and-tilesets.md`](docs/design/fonts-and-tilesets.md).
6. ~~**UI/UX & input framework**~~ — done, see
   [`docs/design/ui-and-input.md`](docs/design/ui-and-input.md).
7. ~~**Build pipeline & dev/prod split**~~ — done, see
   [`docs/design/build-pipeline.md`](docs/design/build-pipeline.md).
8. ~~**Packaging & distribution**~~ — done, see
   [`docs/design/packaging.md`](docs/design/packaging.md).
9. ~~**Custom UI surfaces & interaction hooks**~~ — done, see
   [`docs/design/custom-ui-and-interactions.md`](docs/design/custom-ui-and-interactions.md).
   Added after the original 8-topic roadmap finished, prompted by a gap
   found reviewing it rather than a pre-planned topic — same
   research-and-planning-only treatment as topics 1-8.
10. ~~**Audio**~~ — done, see [`docs/design/audio.md`](docs/design/audio.md).
    Flagged as a gap while writing topic 9's doc.
11. ~~**AI & behavior**~~ — done, see
    [`docs/design/ai-and-behavior.md`](docs/design/ai-and-behavior.md).
    Flagged as a gap while writing topic 9's doc.

After each session, check off the completed item here, link its doc, and
move the NEXT SESSION pointer to the following one.
