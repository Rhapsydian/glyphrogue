# Font & glyph/tileset pipeline

Deep-dive design doc for Glyphrogue's font/glyph/tileset pipeline. Produced
in the session-5 planning pass (see `BACKLOG.md` for the roadmap this fits
into). Treat this as the source of truth for the topics below — `DESIGN.md`
will be trimmed to a short summary linking here, same pattern as
`core-architecture.md`, `rendering.md`, `mapgen-and-editor.md`, and
`scripting-api.md`.

This doc builds directly on `rendering.md`'s render-mode decision (canvas
`fillText` against a shared webfont, DOM reading the same metrics as CSS
custom properties) and generalizes its single-font assumption to multiple
font sources composed within one tileset, while resolving the one question
`rendering.md` explicitly left open for this session: whether material
tinting needs a second, bitmap-blit rendering backend. It doesn't.

## Font sources & the shared cell grid

**What's being generalized, for context**: `rendering.md` assumed one
font — Pixelyph's exported webfont — as the single source for every glyph,
with one shared metrics object (`pixelsPerEm`, `unitsPerEm`, `baselineRow`,
`horizontalPadding`, per-glyph `advanceWidth`/`offsetX`) that both the
canvas and DOM render paths derive their cell size from.

**Decision**: a tileset is not required to draw from one merged font. A
game picks a base font — typically a standard web-safe monospace font —
and can additionally import individual glyphs from other sources (a
Pixelyph-exported custom glyph set, another font entirely) on a per-symbol
basis. Nothing requires pre-merging these into a single compiled font file
before Glyphrogue can use them.

This means the "one shared metrics object" from `rendering.md` has to
generalize from *one font's* metrics to *one shared cell-grid contract*
that every registered font source calibrates itself into. Each font source
gets an explicit, stored **calibration record**:

- **scale factor** — maps that font's own natural glyph size onto the
  tileset's uniform cell (`pixelsPerEm`-equivalent).
- **baseline offset** — aligns that font's baseline to the shared
  `baselineRow`.
- **horizontal-centering mode** — how a glyph narrower or wider than the
  cell is positioned within it.

A shared default-derivation function computes a starting calibration
record for a newly-registered font source, but the record itself is what
gets stored and read at render time — a game (or the future tileset editor,
UI/UX session 6) can override any of the three values and have that
override persist, without changing how rendering consumes it. This mirrors
`mapgen-and-editor.md`'s established principle: the editor is a design-time
surface tuning parameters over the same API/data shape the runtime already
uses, not a separate code path.

**Deferred**: the exact default-derivation formula (how scale/baseline
offset get computed from a font's own metrics on first registration) is an
implementation-time detail — see "Open items" below. This doc decides the
shape (a stored, override-able per-font-source record) rather than the
math, the same treatment `rendering.md` gave the exact FOV/shadowcasting
algorithm variant.

## Pixelyph glyph-set import path

**Decision: asset-only boundary.** Glyphrogue never imports Pixelyph
source code. It only ever consumes Pixelyph's **exported artifacts** —
compiled font files (OTF, and WOFF/WOFF2 once `pixelyph/src/export/font/
woff.js` runs), the icon-font CSS
(`pixelyph/src/export/font/iconFontCss.js`), and the JSON manifest
(`pixelyph/src/export/font/glyphManifest.js`). Pixelyph stays a fully
independent tool; Glyphrogue's tileset pipeline treats its exports the
same way it'd treat any other font source's files.

**Implemented on the Pixelyph side.** The manifest spec below (originally
points A–D) shipped in Pixelyph's `Expand glyph-set JSON manifest for
Glyphrogue's font-source import spec` commit, ahead of Glyphrogue
implementation starting — `generateGlyphManifest()` in `glyphManifest.js`
now produces exactly the shape this doc called for:

- **A. Font-level `meta` block.** `generateGlyphManifest()` returns
  `{ meta, glyphs }`, where `meta` is a straight passthrough of
  `GlyphSet.js`'s in-memory `meta` for `familyName`, `styleName`,
  `pixelsPerEm`, `unitsPerEm`, `ascender`, `descender`, `baselineRow`, and
  `horizontalPadding`. Internal-only fields (e.g. `defaultGlyphWidth`)
  don't leak into it.
- **B. Per-glyph metrics.** Each `glyphs` entry carries `codepoint` (hex),
  `name` (raw, pre-slugify), `slug` (kept as glyph-level metadata, per C
  below), `advanceWidth` and `offsetX` (from the same `glyphMetrics()`
  computation `compileFont.js` already used internally, in grid units),
  and raw `width`/`height`.
- **C. Codepoint as the stable key.** `glyphs` is keyed by lowercase,
  unpadded hex codepoint (`"e000"`, not the slug), so a Glyphrogue
  tileset referencing a glyph by codepoint survives a Pixelyph re-export
  even if names collide and slugs get collision-suffixed
  (`assignGlyphSlugs`/`glyphSlugs.js`) differently next time.
- **D. Manifest generation independent of the icon-font CSS export.** The
  manifest moved out of `iconFontCss.js` entirely into its own
  `glyphManifest.js`, called from a separate `manifest` checkbox in
  Pixelyph's `FontExportPanel` (alongside, not gated behind, `css`). A
  Glyphrogue-bound export can check OTF/WOFF + manifest with CSS left
  unchecked.

Test coverage for the shape above lives in
`pixelyph/test/export/font/glyphManifest.test.js`.

**Non-Pixelyph font sources don't need this spec.** A standard web-safe
monospace font (or any font a user just provides) already encodes
`unitsPerEm`/ascender/descender/per-glyph `advanceWidth` in its own
OpenType tables — sufficient on its own for the calibration step above. The
manifest spec (A–D) exists specifically because Pixelyph's
`pixelsPerEm`/`baselineRow`/`horizontalPadding` are authoring-grid concepts
with no standard OpenType equivalent, not because font sources in general
need an out-of-band metadata file.

## Tileset definition format

**Decision: a thin mapping**, not a rich variant/animation system (nothing
in this session's scope calls for one): a game symbol (wall, floor, a
specific monster) maps to

```
symbol -> { fontFace, codepoint, paletteToken(s) }
```

— a font-face and codepoint pair per symbol (pulling from whichever
registered font source that symbol's glyph actually lives in, per the
previous section), plus a foreground and background palette token.

**`paletteToken(s)` are defaults, not exclusive.** A symbol's assigned
token(s) are what render by default, but any consumer downstream — a
material-tinting rule (see next section), mod content, a themed reskin —
can supply a different token, or a raw color/gradient, at a specific
placement. This is the same curated-token-plus-raw-color-escape-hatch
pattern `rendering.md`'s Color/palette section already established for the
palette system generally: tokens are the default vocabulary, a raw value
is an intentional escape hatch, not the default path.

## Material tinting & fill

**What was left open, for context**: `rendering.md` deferred one question
to this session — whether recoloring a shared glyph per material (the same
wall glyph rendered as stone, brick, or metal) needs a tileset/bitmap-blit
rendering backend (rasterize to a spritesheet, `drawImage` per cell) as a
second rendering mode alongside font-based `fillText`, since that would
introduce a second metrics source alongside font metrics — exactly the kind
of drift font-based rendering was chosen to avoid.

**Decision: it doesn't.** Material tinting is a **draw-time fill decision**,
not a rendering-mode decision:

- **Canvas** sets `ctx.fillStyle` before `fillText` — either a solid token
  color, or a `CanvasGradient` built from a token, resolved per draw call
  from the tileset entry's (or an overriding rule's) palette token(s).
- **DOM** defaults to plain CSS text — a solid color via a CSS custom
  property, exactly as today — and **only** switches to inline SVG
  `<text fill="url(#...)">` when a specific glyph's resolved fill is
  actually a gradient. Plain CSS `color` can't gradient-fill text without a
  `background-clip: text` trick; true SVG `<text fill>` is the reliable
  gradient path. SVG is the exception path taken only when a gradient is
  actually in play, not the default — the common case (solid-color menu
  glyphs, which is most of them) stays exactly as cheap as it is today.
- A **cell background fill** (also token- or gradient-capable) is a second,
  separate fill drawn under the glyph — canvas: a `fillRect` before the
  `fillText` call; DOM: a CSS `background-color` (or, same gradient
  exception, an SVG rect/gradient fill) behind the text.

No pixel-level glyph sublayers are involved: Pixelyph's `GlyphSet.js` has
unused `backgroundPixels`/`foregroundPixels` fields (modeled, but "no UI or
export reads this yet") that were considered and explicitly set aside for
this — tinting doesn't need per-glyph multi-region pixel data, only a
foreground and background fill chosen at draw time.

**Why this resolves the deferred item**: the risk `rendering.md` flagged
was a second metrics source, not a lack of coloring flexibility. Font-based
rendering already draws every glyph through one shared metrics/cell-grid
contract (extended, this session, to cover multiple font sources); tinting
only changes *what fill value* a draw call uses, never *how* a cell is
measured or positioned. A bitmap-blit backend is not needed for material
tinting and is not being built.

**Scope note**: introducing inline SVG `<text>` for the gradient case is a
genuine, if narrow, addition to `DESIGN.md`'s Canvas-viewport/DOM-menus
hybrid split — a DOM-rendered glyph that resolves to a gradient fill
renders as SVG rather than plain HTML text. This is additive, gated on
gradient use, and doesn't change the split's default behavior for ordinary
solid-color UI text.

## Open items carried forward

- **Font-source calibration derivation formula** — the exact math for
  computing a new font source's default scale/baseline-offset/centering
  calibration record (Font sources section, above) is implementation-time
  detail, not decided in this planning pass, same as `rendering.md`'s
  deferred shadowcasting-variant question. The Pixelyph-side inputs this
  formula would consume for a Pixelyph glyph source are now available
  (see "Pixelyph glyph-set import path" above) — this item is about the
  derivation math itself, not about waiting on export data any longer.
