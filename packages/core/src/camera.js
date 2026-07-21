// Camera state (viewport origin + size) and the world -> screen -> canvas
// coordinate pipeline. Lives entirely in the rendering layer, not core
// simulation/save state (rendering.md: derived/read-only over core's
// inspection API, same core/editor API-boundary principle as
// core-architecture.md) - core owns no grid/zone storage, so nothing here
// stores or persists map state either.

export function createCamera({ x = 0, y = 0, viewportWidth, viewportHeight } = {}) {
  return { x, y, viewportWidth, viewportHeight };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

// Deadzone+snap: the camera holds position while the subject's screen-space
// coordinate stays within [deadzone, viewport-1-deadzone] on both axes; once
// it would exit that margin, the camera shifts by exactly the overshoot
// amount (not a recenter-to-center jump), then clamps to map bounds. Always
// returns a NEW camera object.
export function updateCamera(camera, subjectPosition, { deadzone = 3, mapWidth = Infinity, mapHeight = Infinity } = {}) {
  const { col, row } = worldToScreen(camera, subjectPosition.x, subjectPosition.y);

  let nextX = camera.x;
  let nextY = camera.y;

  const minCol = deadzone;
  const maxCol = camera.viewportWidth - 1 - deadzone;
  if (col < minCol) nextX = camera.x - (minCol - col);
  else if (col > maxCol) nextX = camera.x + (col - maxCol);

  const minRow = deadzone;
  const maxRow = camera.viewportHeight - 1 - deadzone;
  if (row < minRow) nextY = camera.y - (minRow - row);
  else if (row > maxRow) nextY = camera.y + (row - maxRow);

  nextX = clamp(nextX, 0, mapWidth - camera.viewportWidth);
  nextY = clamp(nextY, 0, mapHeight - camera.viewportHeight);

  return { ...camera, x: nextX, y: nextY };
}

export function worldToScreen(camera, worldX, worldY) {
  return { col: worldX - camera.x, row: worldY - camera.y };
}

export function screenToWorld(camera, col, row) {
  return { x: col + camera.x, y: row + camera.y };
}

export function screenToCanvasPixel(col, row, cellSize) {
  return { px: col * cellSize.width, py: row * cellSize.height };
}

export function worldToCanvasPixel(camera, worldX, worldY, cellSize) {
  const { col, row } = worldToScreen(camera, worldX, worldY);
  return screenToCanvasPixel(col, row, cellSize);
}

// Half-open on the high edge: a viewport of width W contains columns 0..W-1.
export function isInViewport(camera, col, row) {
  return col >= 0 && col < camera.viewportWidth && row >= 0 && row < camera.viewportHeight;
}
