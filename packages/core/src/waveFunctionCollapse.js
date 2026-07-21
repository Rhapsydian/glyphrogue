import { createZone, stampTemplate, ensureTraversable } from './zoneComposition.js';

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function indexTiles(tiles) {
  const idToIndex = new Map();
  tiles.forEach((tile, index) => idToIndex.set(tile.id, index));
  return idToIndex;
}

// Builds `"${tileIndex}|${dx}|${dy}" -> Set<compatibleTileIndex>` from the
// author's directed adjacency declarations. A tile/direction combination
// with no declared rule has an empty compatible set - authors must declare
// every direction they want to allow, there's no implicit "anything goes"
// default. That's the point of a *minimal* WFC: explicit, not inferred.
function buildAdjacencyIndex(adjacency, idToIndex) {
  const index = new Map();
  for (const rule of adjacency) {
    const a = idToIndex.get(rule.a);
    const b = idToIndex.get(rule.b);
    if (a === undefined || b === undefined) {
      throw new Error(`adjacency rule references unknown tile id: "${rule.a}" or "${rule.b}"`);
    }
    const key = `${a}|${rule.dx}|${rule.dy}`;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(b);
  }
  return index;
}

function regionIndex(region, x, y) {
  return (y - region.y) * region.width + (x - region.x);
}

// Forward-checking propagation: narrows a neighbor's domain to whatever's
// compatible with the just-narrowed cell, re-queuing any neighbor whose
// domain shrank so the narrowing cascades. Not full AC-3 (no support
// counting/backtrack-free arc revision) - adequate for the minimal WFC this
// session scoped, per the design doc's deferral of "exact constraint-solving
// approach" to implementation time.
function propagate(region, domains, adjacencyIndex, startIndices) {
  const queue = [...startIndices];

  while (queue.length > 0) {
    const idx = queue.shift();
    const x = region.x + (idx % region.width);
    const y = region.y + Math.floor(idx / region.width);

    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < region.x || nx >= region.x + region.width || ny < region.y || ny >= region.y + region.height) {
        continue;
      }

      const allowed = new Set();
      for (const tileIdx of domains[idx]) {
        const compatible = adjacencyIndex.get(`${tileIdx}|${dx}|${dy}`);
        if (compatible) for (const b of compatible) allowed.add(b);
      }

      const nIdx = regionIndex(region, nx, ny);
      const before = domains[nIdx];
      const after = new Set([...before].filter((t) => allowed.has(t)));
      if (after.size === before.size) continue;
      if (after.size === 0) return false;

      domains[nIdx] = after;
      queue.push(nIdx);
    }
  }

  return true;
}

function pickWeighted(rng, options, tiles) {
  const totalWeight = options.reduce((sum, ti) => sum + (tiles[ti].weight ?? 1), 0);
  let roll = rng.next() * totalWeight;
  for (const ti of options) {
    const weight = tiles[ti].weight ?? 1;
    if (roll < weight) return ti;
    roll -= weight;
  }
  return options[options.length - 1];
}

// One full collapse attempt over `region`. Returns the finished domains
// array (one collapsed tile index per cell) or null on contradiction -
// callers retry on null, they don't try to resume a partial attempt.
function attemptCollapse(rng, region, tiles, adjacencyIndex) {
  const cellCount = region.width * region.height;
  const domains = new Array(cellCount);
  for (let i = 0; i < cellCount; i++) domains[i] = new Set(tiles.map((_, ti) => ti));

  while (true) {
    let target = -1;
    let bestSize = Infinity;
    for (let i = 0; i < cellCount; i++) {
      const size = domains[i].size;
      if (size > 1 && size < bestSize) {
        bestSize = size;
        target = i;
      }
    }
    if (target === -1) break;

    const chosen = pickWeighted(rng, [...domains[target]], tiles);
    domains[target] = new Set([chosen]);

    if (!propagate(region, domains, adjacencyIndex, [target])) return null;
  }

  return domains;
}

// Minimal WFC (Wave Function Collapse), scoped to `region` so an author can
// collapse WFC content into part of a zone and something else into the
// rest, same composability shape carveBsp/carveCellularAutomata already
// have. `tiles`/`adjacency` are author-declared - no pattern extraction from
// a sample, no frequency learning; a fuller sample-based WFC is backlogged,
// not built here.
export function collapseWfc(zone, rng, options = {}) {
  const {
    region = { x: 0, y: 0, width: zone.width, height: zone.height },
    tiles,
    adjacency = [],
    maxRetries = 50,
  } = options;

  if (!tiles || tiles.length === 0) {
    throw new Error('collapseWfc requires options.tiles');
  }

  const idToIndex = indexTiles(tiles);
  const adjacencyIndex = buildAdjacencyIndex(adjacency, idToIndex);

  let domains = null;
  for (let attempt = 0; attempt < maxRetries && !domains; attempt++) {
    // Retries keep drawing from the same seeded rng stream (never reseeded),
    // so the whole operation - contradictions and all - stays a pure
    // function of the original seed.
    domains = attemptCollapse(rng, region, tiles, adjacencyIndex);
  }

  if (!domains) {
    throw new Error(
      `collapseWfc: no consistent arrangement found after ${maxRetries} attempts - check adjacency rules for satisfiability`
    );
  }

  let entryPoint = null;
  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const tileIdx = [...domains[regionIndex(region, x, y)]][0];
      const cell = tiles[tileIdx].cell;
      zone.cells[y * zone.width + x] = cell;
      if (entryPoint === null && cell !== 'wall') entryPoint = { x, y };
    }
  }

  return { entryPoint: entryPoint ?? { x: region.x, y: region.y } };
}

// Thin whole-zone wrapper over collapseWfc, registerable as-is via
// registerGenerator, same as every other built-in generator.
export function wfcGenerator(ctx) {
  const { width, height, tiles, adjacency, maxRetries, stamps = [] } = ctx.params ?? {};
  if (!width || !height) {
    throw new Error('wfcGenerator requires params.width and params.height');
  }

  const zone = createZone(width, height);
  const { entryPoint } = collapseWfc(zone, ctx.rng, { tiles, adjacency, maxRetries });
  zone.anchors.push({ id: 'entry', x: entryPoint.x, y: entryPoint.y });

  const stampRecords = stamps.map((stamp) => stampTemplate(zone, stamp.template, stamp));

  // connect, not prune: a validly-collapsed WFC region is exactly the
  // content the algorithm exists to produce, so a disconnected pocket gets
  // a corridor rather than getting pruned away.
  ensureTraversable(zone, { entryPoints: [entryPoint], stamps: stampRecords, mode: 'connect' });

  return zone;
}
