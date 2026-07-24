// ZoneDTO -> LivePreview command-list conversion (docs/design/editor.md:
// "Map editor"). LivePreview itself has zero ZoneDTO awareness (see its own
// header comment) - converting a scratch zone into paint commands is the
// map editor's own concern. A generator's cell-type vocabulary is arbitrary
// and not enumerable up front (e.g. layered-biome's biome.cell strings), so
// an unrecognized cell type falls back to a visible placeholder rather than
// a blank/incorrect fill - no tileset-import mechanism exists yet (that's
// roadmap item 9, the tileset/font-calibration editor) to do real coverage.
// Entity types aren't visually distinguished from each other here for the
// same reason - one generic glyph for any entity, since no built-in
// generator places entities by default and per-type glyphs are tileset
// authoring, not this checkpoint's concern.
import { createTileset, registerSymbol, resolveSymbol, has } from '@glyphrogue/core';

const KNOWN_CELL_TYPES = ['wall', 'floor'];
const UNKNOWN_CELL_SYMBOL = 'unknown-cell';
const ENTITY_SYMBOL = 'entity';

// Reuses the editor's existing preview palette tokens (wall/floor/accent/
// player, already defined in App.svelte) rather than introducing new ones -
// blank glyph + background fill, matching the pattern the editor's prior
// LivePreview demo already established for terrain cells.
export function buildDefaultTileset() {
  const tileset = createTileset();
  for (const cellType of KNOWN_CELL_TYPES) {
    registerSymbol(tileset, cellType, { fontFace: 'base', codepoint: '20', background: { token: cellType } });
  }
  registerSymbol(tileset, UNKNOWN_CELL_SYMBOL, { fontFace: 'base', codepoint: '20', background: { token: 'accent' } });
  registerSymbol(tileset, ENTITY_SYMBOL, { fontFace: 'base', codepoint: '40', foreground: { token: 'player' } });
  return tileset;
}

function cellCommand(tileset, fontSources, metrics, col, row, cellType) {
  const symbol = has(tileset, cellType) ? cellType : UNKNOWN_CELL_SYMBOL;
  return { col, row, ...resolveSymbol(tileset, fontSources, metrics, symbol) };
}

function entityCommand(tileset, fontSources, metrics, col, row) {
  const { text, offsetX, baselineOffsetPx, color } = resolveSymbol(tileset, fontSources, metrics, ENTITY_SYMBOL);
  // background deliberately omitted (unlike cellCommand) so the terrain
  // command already painted underneath this cell stays visible -
  // drawTileCell only redraws a background when the command carries one.
  return { col, row, text, offsetX, baselineOffsetPx, color };
}

export function zoneToCommands(zone, { tileset, fontSources, metrics }) {
  const commands = [];
  for (let row = 0; row < zone.height; row++) {
    for (let col = 0; col < zone.width; col++) {
      commands.push(cellCommand(tileset, fontSources, metrics, col, row, zone.cells[row * zone.width + col]));
    }
  }
  for (const entity of zone.entities) {
    commands.push(entityCommand(tileset, fontSources, metrics, entity.x, entity.y));
  }
  return commands;
}
