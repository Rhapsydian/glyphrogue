# Rendering system

Deep-dive design doc for Glyphrogue's rendering layer. Produced in the
session-3 planning pass (see `BACKLOG.md` for the roadmap this fits into).
Treat this as the source of truth for the topics below — `DESIGN.md` will
be trimmed to a short summary linking here once the doc lands, same
pattern as `docs/design/core-architecture.md`.

The rendering layer is a **consumer** of `core`'s public inspection API
(established in `core-architecture.md`), not a privileged internal — it
has no backdoor access to ECS storage, world state, or simulation
internals. Everything below reads through that same API surface the game
runtime, `editor`, and (eventually) mods use.

## Shared glyph-metrics source & render mode

**What the alignment problem is**, for context: `DESIGN.md`'s hybrid
rendering split puts the game viewport (map/entity glyph grid) on Canvas
2D and menus/HUD/dialogs/inventory in the DOM. If each path measures
"one glyph cell" differently, canvas glyphs and DOM text drift out of
alignment wherever they need to line up (e.g. a HUD overlay positioned
against the map grid).

**Decision**: the canvas viewport draws glyphs via `ctx.fillText`, using
the *same* `@font-face` that DOM UI text uses — Pixelyph's exported woff
font plus its icon-font CSS (`pixelyph/src/export/font/compileFont.js`,
`iconFontCss.js`). This is rot.js's "font" `Display` mode, not its tile
(spritesheet-blit) mode. Because both rendering paths draw literally the
same font file, cell-metric alignment is automatic by construction rather
than something hand-synced between two systems.

Metrics come from one shared object, mirroring the shape Pixelyph already
uses internally (`GlyphSet.js`'s `glyphMetrics`, `compileFont.js`):

- `pixelsPerEm` — the canonical glyph-grid cell height, uniform across the
  whole font/tileset.
- `unitsPerEm` — font design-unit scale.
- `baselineRow` — where the text baseline sits within a cell.
- `horizontalPadding` — per-glyph padding applied uniformly.
- Per-glyph `advanceWidth`/`offsetX` for non-monospace-width glyphs, if
  the font isn't strictly fixed-width.

Both render paths derive their cell size from this one object: canvas
sets `ctx.font`'s pixel size and does cell-grid pixel math from it; DOM
exposes the same values as CSS custom properties (e.g. `--glyph-cell-w`,
`--glyph-cell-h`) so DOM grid layouts stay pixel-locked to the same cells.

**Why this is viable, not just simple**: the obvious worry with
`fillText`-per-cell is performance at scale — addressed directly in
"Performance budget" below, where layered canvas redraw keeps the
per-frame `fillText` cost bounded regardless of total map size. This
doc's render-mode decision leans on that analysis rather than picking
`fillText` blind.

**Deferred**: a tileset/bitmap-blit rendering backend (rasterize glyphs to
a sprite sheet, `drawImage` per cell) is a documented possible v2 option —
faster raw blit throughput, easier per-cell recoloring, pixel-consistent
across browsers — behind the same rendering interface, if profiling at
implementation time or session 5's (fonts-and-tilesets) material-tinting
needs make it worth the tradeoff (it introduces a second metrics source —
tile-grid vs. font metrics — that has to be kept in sync by hand, which is
exactly the problem font-based rendering avoids for free). Not built now.

## Camera/viewport and scrolling

**Decision**: camera state — viewport origin (in grid cells) and viewport
size (columns × rows) — lives in the rendering layer, not core
simulation/save state. It's derived, read-only over core's inspection
API (querying entity/player position), not something that needs to
survive a save file. This matches the `core`/`editor` API-boundary
principle from `core-architecture.md`: rendering doesn't get a special
privileged read path into core internals just because it needs frequent
position queries.

The coordinate pipeline: world-grid coordinates → screen-cell coordinates
(world cell minus camera origin) → canvas-pixel coordinates (screen cell
× cell size from the shared glyph metrics above).

**Scroll behavior: deadzone + snap.** The camera holds its position as
long as the player stays within an inner deadzone margin of the viewport.
Only when the player's screen position would exit that margin does the
camera shift — and it shifts by exactly the number of cells needed to
keep the player at the deadzone boundary, not a full recenter-to-center
jump. This means small back-and-forth movement near the viewport center
causes zero camera motion, and sustained movement toward an edge makes
the camera "keep pace" one cell at a time rather than jumping.

This is still a **snap** motion — each recenter step is an integer-cell
jump matching turn cadence, not a smooth pixel interpolation. That's a
deliberate choice to decouple camera movement from the animation system
(see "Animation" below): smooth pixel-lerp scrolling would compose
directly with that system's still-open `lock`/`unlock` timing question,
and deciding it now would mean building on an admittedly-unresolved
dependency. Smooth scrolling is noted as a later option, gated on that
question actually being resolved.

Camera clamps to map bounds (won't scroll the viewport past the edge of
the map into undefined space).

## Color/palette system

**Decision: curated token palette with a raw-color escape hatch.** The
default vocabulary for content is a fixed set of named semantic color
tokens (e.g. `danger`, `hp-low`, `wall-stone`, `water`) rather than
scattered raw hex values. One palette/theme data object is the single
source both render paths consume — canvas reads it for `fillStyle`, DOM
reads it as CSS custom properties — the same shared-source principle as
the glyph-metrics decision above.

Rationale: a curated token set gives visual cohesion matching the
project's monospace/pixel-glyph identity, makes the whole palette
reskinnable by swapping one theme object, and gives exactly one place to
audit contrast and colorblind-safety instead of that being each content
author's problem independently. Content — including future mod content,
once the plugin API (session 4) exists — can still specify a raw hex
color directly when a token genuinely doesn't fit; that's an intentional
escape hatch, not the default path, and its usage guidelines (when it's
appropriate vs. overused) are likely worth revisiting once real
content/modding exists to look at.

**Scope boundary**: this section covers resolving a color *value* for
rendering. Per-glyph *material tinting* (e.g. the same wall glyph
recolored for stone vs. brick vs. metal) is a fonts-and-tilesets concern
(session 5) — flagged here as a future consumer of this palette system,
not designed in this doc.

## FOV/lighting visualization

**What FOV and shadowcasting are**, for context: Field-of-View is which
map cells an observer (the player, a monster) can currently see from
their position, typically computed by *shadowcasting* — walking outward
from the origin cell and treating opaque cells (walls) as casting shadows
that block visibility to cells behind them, rather than a naive
line-of-sight ray per cell.

**Decision**: `core` exposes **one shared shadowcasting/visibility
primitive** — given an origin cell, a radius, and an opacity query over
the map (rot.js's `FOV` module is useful prior art here), it returns which
cells are visible. This is a primitive, not three separate
implementations, and three different consumers build on it over the same
inspection API:

1. **Player FOV** — feeds the render-visibility state this doc actually
   covers (below).
2. **Per-monster FOV** — AI "can I see the player" perception checks.
   This is session 4 (scripting/content API) territory functionally, but
   the primitive itself lives in `core` now so it's ready when that
   session needs it.
3. **Light-source propagation** — each light source computes its reach
   using the same primitive, then per-cell light contributions from
   multiple sources blend together.

The binary visible/not-visible set (FOV) and the graded radius/intensity
falloff (light) differ in what's built *on top* of the shared primitive,
not in the underlying shadowcasting call itself. This mirrors
`core-architecture.md`'s "one public API surface, no per-consumer
backdoors" principle — the alternative (rendering computing its own FOV,
AI computing a separate one) risks the two silently drifting apart.

`core` exposes the *results* of all this as per-cell state: a
visibility classification (visible / remembered / unknown) plus light
level/color, queryable the same way any other world state is. This doc's
job is only the **visualization** half — mapping that per-cell state to
render treatment, through the palette system above:

- **Visible** cells render tinted by their current light color/level.
- **Unknown** cells (never seen) render blank.
- **Remembered** cells (previously seen, currently out of FOV) render in
  a **flat memory tone by default** — a single desaturated/dimmed
  treatment regardless of what light they were under when last observed.
  This avoids implying stale light information is still accurate. A
  theme/author-level switch can instead preserve last-known light/color
  for remembered cells (more atmospheric, at the cost of implying
  currently-unverifiable information) — this is a configurable rendering
  option, not a hardcoded behavior, so a game can pick either without a
  code change.

**Deferred**: the exact shadowcasting variant (recursive shadowcasting vs.
alternatives) is an implementation-time detail, not decided in this
planning pass.

## Animation

**What the model/view split means here**, for context: the turn engine
(`core-architecture.md`) resolves actions and mutates world state
synchronously and instantly — a `Move` action updates an entity's
position in one step, with no notion of "this movement takes 200ms."
Animation is purely a rendering-layer concern: the *model* jumps
instantly, the *view* plays a tween to make that jump visually smooth.

**Decision**: a real-time render loop (`requestAnimationFrame`),
decoupled from the turn engine's `lock`/`unlock` async loop. Two
categories of animated content:

- **Tweened entity movement** — rendering keeps the previous and current
  position snapshots for a moved entity and interpolates the drawn
  position between them over the animation's duration, even though the
  model's position updated instantly.
- **Transient effects** — damage numbers, hit flashes, and similar
  content that never touches model state at all; purely a rendering-layer
  construct with its own lifetime.

**Left fully open, explicitly carried forward** (discussed directly
rather than decided speculatively): what `lock()` does during animation
playback.

- **Lock held for the animation's duration** — serializes turns so the
  player always sees one action's animation finish before the next
  starts. Simple, avoids visual overlap/confusion about what happened
  when. Known risk: the "AI turn spam" pacing problem in turn-based games
  with animation — a turn with many acting monsters means watching many
  sequential animations before regaining control (the reason games like
  XCOM ship an alien-turn skip/speed-up option).
- **Allow overlap** — animations play concurrently without blocking the
  engine. Feels faster on busy multi-actor turns, but requires rendering
  to read from a queue of pending visual events rather than just "current
  model state" (since the model can already be several actions ahead of
  what's visually settled) — a real architectural piece, a render-event
  buffer, not a flag flip. Risks visual confusion when multiple animations
  land near each other simultaneously.

No directional lean is recorded here — this composes with the `act()`
contract question already left open in `core-architecture.md`, and a
render-event-buffer design (if overlap is chosen) needs its own dedicated
research pass rather than being decided as a side effect of this session.

## Performance budget for large maps

**Decision**: only the camera viewport (plus a small margin) is ever
drawn — never the full map, regardless of map size. This builds directly
on the camera/viewport section above.

**Layered canvas**, split by redraw frequency rather than one canvas
redrawn wholesale every frame:

- **Static/terrain layer** — redrawn only when the camera scrolls or the
  map itself mutates (a cell is dug out, a door opens/closes). Most
  frames, this layer doesn't redraw at all.
- **Entity/effects layer** — redrawn every animation frame (to support
  the animation system above), but containing only the cells actually
  animating (moving creatures, projectiles, transient effects) — not the
  full viewport.

**Why this matters for the render-mode decision above**: the performance
risk with `ctx.fillText` was never `fillText` itself — it's redrawing the
*entire viewport* every frame. Rough consensus from prior art (rot.js
`Display` benchmarks, general canvas-roguelike discussion) puts
`fillText` bottlenecks somewhere in the low-thousands of cells redrawn
*per frame*. With layering, the terrain layer (which could be thousands
of cells) redraws rarely — on scroll, not every frame — and the
per-frame-critical entity/effects layer stays small (tens of cells even
in a busy fight) regardless of total viewport or map size. This is what
makes the font-based decision in the first section viable without
resorting to tileset blit.

**Scale target**: "large map" for budgeting purposes means a viewport in
the Qud/Cogmind range — roughly 80×25 to 100×40 visible cells. The
underlying map size itself is treated as unbounded, since it's never
drawn in full — only ever the viewport window into it.

## Open items carried forward

- Tileset/bitmap blit rendering mode (vs. font-based) — revisit at
  implementation time or the fonts-and-tilesets session (5) if material
  tinting needs it.
- Smooth pixel-lerp camera scrolling — later option, gated on the
  animation `lock`/`unlock` question below being resolved first.
- `lock`/`unlock` interaction with animation playback duration — left
  fully open, no directional lean recorded; needs dedicated research,
  same as `core-architecture.md`'s `act()` contract question.
- Exact FOV/shadowcasting algorithm variant — implementation time, not
  this planning pass.
- Raw-color escape-hatch usage guidelines (when appropriate vs.
  overused) — likely revisited once real content/modding exists
  (scripting-api session, topic 4).
