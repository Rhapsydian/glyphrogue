export function createZone(width, height, fillCell = 'wall') {
  return {
    width,
    height,
    cells: new Array(width * height).fill(fillCell),
    entities: [],
    anchors: [],
    logicalLinks: [],
  };
}

// 0/90/180/270deg rotation of a point within a width x height grid, used to
// map a template's local coordinates into a zone's coordinate space.
function rotatePoint(x, y, width, height, rotation) {
  switch (rotation) {
    case 0:
      return [x, y];
    case 90:
      return [height - 1 - y, x];
    case 180:
      return [width - 1 - x, height - 1 - y];
    case 270:
      return [y, width - 1 - x];
    default:
      throw new Error(`unsupported rotation: ${rotation}`);
  }
}

function rotatedDimensions(width, height, rotation) {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

// Copies a template's cells/entities/anchors into `zone` at an offset,
// rotated 0/90/180/270deg. A "template" is itself a ZoneDTO (cells,
// entities, anchors) - stamping doesn't need a separate DTO shape, per
// mapgen-and-editor.md's "one zone format" decision. Returns a stamp
// record for the caller to collect and hand to runConnectivityPass.
export function stampTemplate(zone, template, { x, y, rotation = 0, mayBeIsolated = false, reachableVia } = {}) {
  const { width: stampWidth, height: stampHeight } = rotatedDimensions(template.width, template.height, rotation);

  for (let ty = 0; ty < template.height; ty++) {
    for (let tx = 0; tx < template.width; tx++) {
      const [rx, ry] = rotatePoint(tx, ty, template.width, template.height, rotation);
      const zx = x + rx;
      const zy = y + ry;
      if (zx < 0 || zx >= zone.width || zy < 0 || zy >= zone.height) continue;
      zone.cells[zy * zone.width + zx] = template.cells[ty * template.width + tx];
    }
  }

  for (const entity of template.entities) {
    const [rx, ry] = rotatePoint(entity.x, entity.y, template.width, template.height, rotation);
    zone.entities.push({ ...entity, x: x + rx, y: y + ry });
  }

  const anchors = template.anchors.map((anchor) => {
    const [rx, ry] = rotatePoint(anchor.x, anchor.y, template.width, template.height, rotation);
    return { ...anchor, x: x + rx, y: y + ry };
  });

  return {
    anchors,
    bounds: { x, y, width: stampWidth, height: stampHeight },
    mayBeIsolated,
    reachableVia,
  };
}

function isWallAt(cells, width, region, x, y) {
  if (x < region.x || x >= region.x + region.width || y < region.y || y >= region.y + region.height) {
    return true;
  }
  return cells[y * width + x] === 'wall';
}

// Iterative neighbor-count cellular automata carve: random fill, then
// `passes` smoothing rounds (a cell becomes wall when >= wallThreshold of
// its 8 neighbors are wall). Out-of-region neighbors count as wall, so the
// carved region stays enclosed. Pure function of `rng` - deterministic for
// a given seed and fixed row-major iteration order.
export function carveCellularAutomata(zone, rng, options = {}) {
  const {
    fillProbability = 0.45,
    passes = 4,
    wallThreshold = 5,
    region = { x: 0, y: 0, width: zone.width, height: zone.height },
  } = options;

  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      zone.cells[y * zone.width + x] = rng.next() < fillProbability ? 'wall' : 'floor';
    }
  }

  for (let pass = 0; pass < passes; pass++) {
    const snapshot = zone.cells.slice();

    for (let y = region.y; y < region.y + region.height; y++) {
      for (let x = region.x; x < region.x + region.width; x++) {
        let wallCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (isWallAt(snapshot, zone.width, region, x + dx, y + dy)) wallCount++;
          }
        }
        zone.cells[y * zone.width + x] = wallCount >= wallThreshold ? 'wall' : 'floor';
      }
    }
  }
}
