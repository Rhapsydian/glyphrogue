// Layered canvas redraw (rendering.md's performance section): only the
// camera viewport is ever drawn, split by redraw frequency rather than one
// canvas redrawn wholesale every frame - the static/terrain layer redraws
// only on scroll/map mutation, the entity/effects layer redraws every
// animation frame but only for the small set of cells actually animating.
import { worldToScreen, isInViewport } from './camera.js';
import { tweenedPosition } from './animation.js';
import { setLayerFont, drawTileCell } from './glyphRenderer.js';

export function createLayerState() {
  return { terrainDirtyKey: null };
}

function sameKey(a, b) {
  return a != null && b != null && a.originX === b.originX && a.originY === b.originY && a.mapVersion === b.mapVersion;
}

// key: an opaque caller-supplied { originX, originY, mapVersion } tuple -
// the caller bumps mapVersion whenever its own zone data changes; rendering
// never needs to know why (same DI shape as isWalkable/isOpaque/
// getNeighborZone - caller owns the shape, core just compares it).
export function terrainLayerDirty(state, key) {
  return !sameKey(state.terrainDirtyKey, key);
}

export function markTerrainClean(state, key) {
  state.terrainDirtyKey = key;
}

// cellQuery(worldX, worldY) -> { text, color, background? } | null
export function terrainDrawCommands(camera, cellQuery) {
  const commands = [];
  for (let row = 0; row < camera.viewportHeight; row++) {
    for (let col = 0; col < camera.viewportWidth; col++) {
      const { x, y } = { x: camera.x + col, y: camera.y + row };
      const cell = cellQuery(x, y);
      if (cell) commands.push({ col, row, text: cell.text, color: cell.color, ...(cell.background !== undefined && { background: cell.background }) });
    }
  }
  return commands;
}

// entities: [{ entity, position, text, color, background? }]
export function entityDrawCommands(camera, entities, animationState, now) {
  const commands = [];
  for (const { entity, position, text, color, background } of entities) {
    const drawnPosition = tweenedPosition(animationState, entity, position, now);
    const { col, row } = worldToScreen(camera, drawnPosition.x, drawnPosition.y);
    if (isInViewport(camera, col, row)) commands.push({ col, row, text, color, ...(background !== undefined && { background }) });
  }
  return commands;
}

export function paintLayer(ctx, metrics, cellSize, fontFamily, commands, { clear = true, viewportPixelWidth, viewportPixelHeight, palette } = {}) {
  setLayerFont(ctx, metrics, fontFamily);
  if (clear) ctx.clearRect(0, 0, viewportPixelWidth, viewportPixelHeight);
  for (const command of commands) {
    drawTileCell(ctx, metrics, cellSize, palette, command);
  }
}
