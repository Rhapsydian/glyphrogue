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

// Carves an L-shaped floor path between two points (horizontal then
// vertical), only ever turning wall cells to floor - a door/anchor cell at
// either endpoint is left as whatever it already was.
export function connectCorridor(zone, from, to) {
  const carve = (x, y) => {
    if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) return;
    const index = y * zone.width + x;
    if (zone.cells[index] === 'wall') zone.cells[index] = 'floor';
  };

  let { x, y } = from;
  carve(x, y);
  while (x !== to.x) {
    x += x < to.x ? 1 : -1;
    carve(x, y);
  }
  while (y !== to.y) {
    y += y < to.y ? 1 : -1;
    carve(x, y);
  }
}

const cellKey = (x, y) => `${x},${y}`;

export function isWalkableCell(zone, x, y) {
  if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) return false;
  return zone.cells[y * zone.width + x] !== 'wall';
}

// BFS reachability over physical adjacency (4-directional, non-wall cells)
// plus zone.logicalLinks edges (teleporters/portals/gated doors) - a link
// is a valid path even when its endpoints aren't physically adjacent.
// Same-zone link targets feed back into the flood fill; cross-zone targets
// (`to.zoneId` set) have no local cell to add, so they're leaf edges.
function floodFillReachable(zone, startPoints) {
  const linksByCell = new Map();
  for (const link of zone.logicalLinks ?? []) {
    const addEdge = (from, to) => {
      const k = cellKey(from.x, from.y);
      if (!linksByCell.has(k)) linksByCell.set(k, []);
      linksByCell.get(k).push(to);
    };
    if (!link.to.zoneId) addEdge(link.from, link.to);
    if (link.bidirectional && !link.to.zoneId) addEdge(link.to, link.from);
  }

  const reached = new Set();
  const queue = [];

  for (const point of startPoints) {
    const k = cellKey(point.x, point.y);
    if (!reached.has(k)) {
      reached.add(k);
      queue.push(point);
    }
  }

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];

    for (const n of neighbors) {
      const k = cellKey(n.x, n.y);
      if (reached.has(k) || !isWalkableCell(zone, n.x, n.y)) continue;
      reached.add(k);
      queue.push(n);
    }

    for (const n of linksByCell.get(cellKey(x, y)) ?? []) {
      const k = cellKey(n.x, n.y);
      if (reached.has(k)) continue;
      reached.add(k);
      queue.push(n);
    }
  }

  return reached;
}

function pointsInBounds(bounds) {
  const points = [];
  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      points.push({ x, y });
    }
  }
  return points;
}

export function nearestOpenCell(zone, bounds) {
  const open = pointsInBounds(bounds).find(({ x, y }) => isWalkableCell(zone, x, y));
  return open ?? { x: bounds.x, y: bounds.y };
}

function nearestReachedPoint(reached, target) {
  let best;
  let bestDist = Infinity;
  for (const k of reached) {
    const [x, y] = k.split(',').map(Number);
    const dist = Math.abs(x - target.x) + Math.abs(y - target.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { x, y };
    }
  }
  return best;
}

// Mandatory post-generation pass (mapgen-and-editor.md's "Connectivity
// pass"): floods reachability from `entryPoints`, then for each stamp not
// already reached, auto-connects it via connectCorridor - preferring a
// declared anchor over guessing the nearest open cell. `mayBeIsolated`
// stamps are left alone; a `reachableVia` stamp is trusted as reachable
// through its declared logical link and skips auto-connect entirely (the
// link's existence is validated, but its live on/off state is a runtime
// gameplay concern, not this pass's).
export function runConnectivityPass(zone, { entryPoints, stamps = [] } = {}) {
  let reached = floodFillReachable(zone, entryPoints);
  const linksById = new Map((zone.logicalLinks ?? []).map((link) => [link.id, link]));

  for (const stamp of stamps) {
    if (stamp.mayBeIsolated) continue;

    if (stamp.reachableVia !== undefined) {
      if (!linksById.has(stamp.reachableVia)) {
        throw new Error(`stamp reachableVia "${stamp.reachableVia}" does not match any logicalLinks id`);
      }
      continue;
    }

    const alreadyReached = pointsInBounds(stamp.bounds).some(({ x, y }) => reached.has(cellKey(x, y)));
    if (alreadyReached) continue;

    const target = stamp.anchors[0] ?? nearestOpenCell(zone, stamp.bounds);
    const source = nearestReachedPoint(reached, target);
    connectCorridor(zone, source, target);

    reached = floodFillReachable(zone, entryPoints);
  }

  return reached;
}

function stampCellKeys(stamps) {
  const keys = new Set();
  for (const stamp of stamps) {
    for (const { x, y } of pointsInBounds(stamp.bounds)) {
      keys.add(cellKey(x, y));
    }
  }
  return keys;
}

function findUnreachedWalkableCell(zone, reached, excluded) {
  for (let y = 0; y < zone.height; y++) {
    for (let x = 0; x < zone.width; x++) {
      const k = cellKey(x, y);
      if (reached.has(k) || excluded.has(k)) continue;
      if (isWalkableCell(zone, x, y)) return { x, y };
    }
  }
  return null;
}

// Composable follow-up to runConnectivityPass for algorithms (CA, WFC,
// layered biome) whose base carve can leave walkable cells disconnected
// from anything runConnectivityPass's stamp-only auto-connect covers.
// Stamp bounds are always excluded from prune/connect handling, whether or
// not a given stamp ended up reached - that's what preserves a
// `mayBeIsolated` stamp's interior when the rest of the zone gets pruned.
export function ensureTraversable(zone, { entryPoints, stamps = [], mode = 'prune' } = {}) {
  const reached = runConnectivityPass(zone, { entryPoints, stamps });
  const excluded = stampCellKeys(stamps);

  if (mode === 'prune') {
    for (let y = 0; y < zone.height; y++) {
      for (let x = 0; x < zone.width; x++) {
        const k = cellKey(x, y);
        if (reached.has(k) || excluded.has(k)) continue;
        if (isWalkableCell(zone, x, y)) zone.cells[y * zone.width + x] = 'wall';
      }
    }
    return reached;
  }

  if (mode === 'connect') {
    let current = reached;
    const maxIterations = zone.width * zone.height;
    for (let i = 0; i < maxIterations; i++) {
      const unreached = findUnreachedWalkableCell(zone, current, excluded);
      if (!unreached) break;
      const source = nearestReachedPoint(current, unreached);
      connectCorridor(zone, source, unreached);
      current = floodFillReachable(zone, entryPoints);
    }
    return current;
  }

  throw new Error(`unsupported ensureTraversable mode: "${mode}"`);
}
