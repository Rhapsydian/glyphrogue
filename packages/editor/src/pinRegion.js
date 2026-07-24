// Pin/lock (docs/design/editor.md: "Map editor") - marquee-drag a region on
// the preview, snapshot its cells + entity placements, and patch that
// snapshot back into a freshly-generated zone before rendering. Also the
// mechanism behind pin/lock + generator-switch: pinning a region generated
// by one algorithm, then switching the generator dropdown before rerolling,
// drops that pinned content into a differently-generated surrounding zone -
// a real, cheap interactive composition affordance, distinct from (and much
// simpler than) the deferred generator-composition codegen tool.
import { screenToWorld } from '@glyphrogue/core';

export function pixelToWorldCell(px, py, cellSize, camera) {
  const col = Math.floor(px / cellSize.width);
  const row = Math.floor(py / cellSize.height);
  return screenToWorld(camera, col, row);
}

// Two corners of a drag, either direction - normalizes to a top-left-
// anchored rect. Inclusive of both corner cells (a single-cell drag should
// pin exactly one cell, not zero).
export function normalizeMarqueeBounds(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1 };
}

export function clampBoundsToZone(bounds, zone) {
  const x0 = Math.max(0, bounds.x);
  const y0 = Math.max(0, bounds.y);
  const x1 = Math.min(zone.width, bounds.x + bounds.width);
  const y1 = Math.min(zone.height, bounds.y + bounds.height);
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

function withinBounds(x, y, bounds) {
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

function withinZone(x, y, zone) {
  return x >= 0 && x < zone.width && y >= 0 && y < zone.height;
}

// Entities are single-point placements ({type,x,y,data} - zoneComposition.js
// has no width/height concept for them), so "an entity within the region"
// is exact point-containment, not overlap.
export function snapshotRegion(zone, bounds) {
  const cells = [];
  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      cells.push({ x, y, cell: zone.cells[y * zone.width + x] });
    }
  }
  const entities = zone.entities.filter((entity) => withinBounds(entity.x, entity.y, bounds)).map((entity) => ({ ...entity }));
  return { bounds, cells, entities };
}

// Mutates and returns zone. Cells/entities are individually bounds-checked
// against the zone actually being patched into (not just snapshot.bounds
// itself) - pin/lock + generator-switch means the zone being rerolled into
// may have different dimensions than the zone the pin was taken from (a
// different generator, or the author changing width/height in between), so
// a naive replay could otherwise write past the new zone's actual cells.
export function patchRegionIntoZone(zone, snapshot) {
  for (const { x, y, cell } of snapshot.cells) {
    if (!withinZone(x, y, zone)) continue;
    zone.cells[y * zone.width + x] = cell;
  }
  zone.entities = zone.entities.filter((entity) => !withinBounds(entity.x, entity.y, snapshot.bounds));
  zone.entities.push(...snapshot.entities.filter((entity) => withinZone(entity.x, entity.y, zone)).map((entity) => ({ ...entity })));
  return zone;
}
