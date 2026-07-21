# Data model reference

A living reference for `packages/core`'s actual data shapes — components,
action payloads, save DTOs, and content/asset formats. This is **not**
another `docs/design/*.md` planning-session doc; those are point-in-time
decision records (why a choice was made). This doc tracks the *current,
real* shape of things as implementation defines them.

**Maintenance rule**: update this doc as part of the implementation work
that defines or changes a shape — not speculatively ahead of code. Every
entry below is currently an **illustrative example** sketched in a design
doc, not a committed schema; as real code lands, replace the design-doc
cross-reference with a pointer at the actual source file/type and drop the
"illustrative" tag. A stale entry here is worse than no entry — if
something changes and this doc isn't updated in the same PR, that's a bug
in the PR, not a documentation backlog item.

## Components

| Name | Description | Source | Status |
|---|---|---|---|
| `Position` | `{x, y}` | `core-architecture.md` | illustrative |
| `Health` | `{current, max}` | `core-architecture.md` | illustrative |
| `Inventory` | `{items}` | `core-architecture.md` | illustrative |
| `ExplodesOnDeath` | marker (no data) | `scripting-api.md` | illustrative |
| `Wanders` / `ChasesPlayer` / `Flees` / `Guards` | markers, first-party `TakeTurn` behaviors | `ai-and-behavior.md` | illustrative |
| `EventState` | `{ step }` — multi-step scripted-event progress | `scripting-api.md` | illustrative |
| `PendingUI` | `{ screenId, payload }` — generic core→UI hand-off marker; supersedes the earlier `PendingDialogue`-only concept (`ui-and-input.md`'s `ShowDialogue` is now `PendingUI`'s first built-in consumer) | `custom-ui-and-interactions.md` | illustrative |
| `PlayerControlled` | marker (no data) — distinguishes the player-controlled actor so `engine.js`'s `act()` locks and waits for external input instead of auto-dispatching `TakeTurn` | `packages/core/src/engine.js` | implemented |

## Action types

| Type | Notes | Source | Status |
|---|---|---|---|
| `Move`, `Attack`, `Damage`, `Death` | core's first-party default combat/movement vocabulary — swappable per-encounter, not exclusive (`custom-ui-and-interactions.md`) | `core-architecture.md` | illustrative |
| `OpenDoor` | example non-combat action | `core-architecture.md` | illustrative |
| `TakeTurn` | core-shipped, dispatched per non-player actor's turn; zero time-units cost itself | `ai-and-behavior.md` | illustrative |
| `EnterRegion` | scripted-event trigger example (map-region entry) | `scripting-api.md` | illustrative |
| `EventTimerElapsed` | synthetic action emitted by a scheduled timer entity for `waitFor: { timeUnits }` | `scripting-api.md` | illustrative |
| Author-defined closing actions (`ResolveSkillCheck`, `ResolveBattle`, ...) | naming is author's choice, not core-mandated | `custom-ui-and-interactions.md` | illustrative |
| `cost` field (optional, on any action) | variable per-instance time-units cost (`{ type: 'Move', entity, cost: 100 }`) — `engine.js`'s `act()`/`resolvePlayerAction()` sum `cost` across every action a turn resolves to and spend the total from the scheduler | `packages/core/src/engine.js` | implemented |

## Save DTO shapes

| Shape | Notes | Source | Status |
|---|---|---|---|
| Top-level save | `{ coreSchemaVersion, core, gameDataVersion, game, mods: { [modId]: { modDataVersion, payload } } }` | `core-architecture.md`, `scripting-api.md` | illustrative |
| `ZoneDTO` | shared shape for generated, hand-authored, and loaded-from-diff zones | `mapgen-and-editor.md` | illustrative — diff/overlay format for mod-defined entity types still open, see `BACKLOG.md` |
| Settings slice | keybindings, volume/mixing — persists outside save data, own storage key | `ui-and-input.md`, `audio.md` | illustrative |

## Content/asset formats

| Format | Notes | Source | Status |
|---|---|---|---|
| Tileset entry | `symbol -> { fontFace, codepoint, paletteToken(s) }` | `fonts-and-tilesets.md` | illustrative |
| Palette/theme object | token vocabulary + raw-color escape hatch, one object both render paths read | `rendering.md` | illustrative |
| Font-source calibration record | `{ scale factor, baseline offset, horizontal-centering mode }` | `fonts-and-tilesets.md` | illustrative — derivation formula still open |
| Pixelyph glyph manifest | `{ meta, glyphs }`, `glyphs` keyed by lowercase hex codepoint | `fonts-and-tilesets.md` | **implemented** on the Pixelyph side already |

## Registration & API surface

| Call/shape | Notes | Source | Status |
|---|---|---|---|
| `api.register*(id, def, options?)` | `registerEntity`, `registerEntityType`, `registerRule`, `registerGenerator`, `registerScriptedEvent`, `registerScreen`, `registerSound` — one shared shape, one conflict/override mechanism | `scripting-api.md` and each feature doc | illustrative |
| `ctx` query/mutation methods | `hasComponent`, `getComponent`, `findPath`, etc. | `core-architecture.md`, `ai-and-behavior.md` | illustrative |
| `GenerationContext` | seeded RNG, `params`, neighboring-zone read access | `mapgen-and-editor.md` | illustrative |
