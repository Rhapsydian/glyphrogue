// Shared boot logic between the shipped game (index.html -> main.js) and
// the dev harness (dev.html -> dev-main.js). Imports only @glyphrogue/core
// - this file must never import @glyphrogue/editor, or the two-entry
// dev/prod split stops being structural (build-pipeline.md).
import {
  createTileset,
  registerSymbol,
  resolveSymbol,
  createPalette,
  createGlyphMetrics,
  cellSize,
  paintLayer,
  has,
} from '@glyphrogue/core';
import { createStarterFontSources, STARTER_FONT_ID, STARTER_FONT_CSS_FAMILY } from '../assets/fonts/starter-font.js';
import starterRoom from './maps/templates/starter-room.json';

const ENTITY_SYMBOL = 'entity';

function buildTileset() {
  const tileset = createTileset();
  registerSymbol(tileset, 'wall', { fontFace: STARTER_FONT_ID, codepoint: '20', background: { token: 'wall' } });
  registerSymbol(tileset, 'floor', { fontFace: STARTER_FONT_ID, codepoint: '20', background: { token: 'floor' } });
  registerSymbol(tileset, ENTITY_SYMBOL, { fontFace: STARTER_FONT_ID, codepoint: '40', foreground: { token: 'entity' } });
  return tileset;
}

export function buildPalette() {
  return createPalette({
    wall: '#555555',
    floor: '#222222',
    entity: '#e0a030',
  });
}

function zoneToCommands(zone, { tileset, fontSources, metrics }) {
  const commands = [];
  for (let row = 0; row < zone.height; row++) {
    for (let col = 0; col < zone.width; col++) {
      const cellType = zone.cells[row * zone.width + col];
      const symbol = has(tileset, cellType) ? cellType : 'wall';
      commands.push({ col, row, ...resolveSymbol(tileset, fontSources, metrics, symbol) });
    }
  }
  for (const entity of zone.entities) {
    const { text, offsetX, baselineOffsetPx, color } = resolveSymbol(tileset, fontSources, metrics, ENTITY_SYMBOL);
    // background deliberately omitted so the terrain command already
    // painted underneath this cell stays visible.
    commands.push({ col: entity.x, row: entity.y, text, offsetX, baselineOffsetPx, color });
  }
  return commands;
}

// zone.entities/zone.anchors are inert blueprint data (docs/data-model.md),
// not live entities, until something actually instantiates them - this is
// that step, called once on a genuine cold start.
export function instantiateZoneContent(api) {
  for (const entity of starterRoom.entities) {
    api.instantiateEntity(entity.type, { Position: { x: entity.x, y: entity.y } });
  }

  const playerStart = starterRoom.anchors.find((anchor) => anchor.id === 'player-start');
  const player = api.createEntity();
  api.addComponent(player, 'Position', { x: playerStart.x, y: playerStart.y });
  api.addComponent(player, 'PlayerControlled', {});
  return player;
}

// Renders the starter room's static template directly, not a live query
// over ECS world state - proving the render pipeline (tileset, font
// source, palette, paintLayer) works end to end without also needing a
// camera/input loop, which is real gameplay's job, not this scaffold's.
export function renderZone(container) {
  const tileset = buildTileset();
  const fontSources = createStarterFontSources();
  const palette = buildPalette();
  const metrics = createGlyphMetrics({ pixelsPerEm: 24 });
  const size = cellSize(metrics);

  const canvas = document.createElement('canvas');
  canvas.width = starterRoom.width * size.width;
  canvas.height = starterRoom.height * size.height;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const commands = zoneToCommands(starterRoom, { tileset, fontSources, metrics });
  paintLayer(ctx, metrics, size, STARTER_FONT_CSS_FAMILY, commands, {
    clear: true,
    viewportPixelWidth: canvas.width,
    viewportPixelHeight: canvas.height,
    palette,
  });
}
