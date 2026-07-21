import { createZone, stampTemplate, ensureTraversable, nearestOpenCell } from './zoneComposition.js';

function weightedPick(rng, items, weightOf) {
  const totalWeight = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = rng.next() * totalWeight;
  for (const item of items) {
    const weight = weightOf(item);
    if (roll < weight) return item;
    roll -= weight;
  }
  return items[items.length - 1];
}

// Base biome-region layer: scatter seedCount points, assign each a biome by
// weighted draw, then assign every cell to its nearest seed by Manhattan
// distance - a Voronoi-like partition. No CA smoothing inside a region
// (deliberately, per this session's scoping - no masked-CA primitive
// exists), scoped to `region` so an author can compose this with another
// algorithm elsewhere in the same zone, same as carveBsp/carveCellularAutomata/
// collapseWfc. Returns an entryPoint (nearestOpenCell, same convention the
// CA generator uses) for composition with an adjacent region.
export function partitionBiomes(zone, rng, options = {}) {
  const {
    region = { x: 0, y: 0, width: zone.width, height: zone.height },
    biomes,
    seedCount = biomes.length * 2,
  } = options;

  if (!biomes || biomes.length === 0) {
    throw new Error('partitionBiomes requires options.biomes');
  }

  const seeds = [];
  for (let i = 0; i < seedCount; i++) {
    const x = region.x + Math.floor(rng.next() * region.width);
    const y = region.y + Math.floor(rng.next() * region.height);
    const biome = weightedPick(rng, biomes, (b) => b.weight ?? 1);
    seeds.push({ x, y, biome });
  }

  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      let nearest = seeds[0];
      let bestDist = Infinity;
      for (const seed of seeds) {
        const dist = Math.abs(seed.x - x) + Math.abs(seed.y - y);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = seed;
        }
      }
      zone.cells[y * zone.width + x] = nearest.biome.cell;
    }
  }

  return { entryPoint: nearestOpenCell(zone, region) };
}

// Thin whole-zone wrapper over partitionBiomes, registerable as-is via
// registerGenerator, same as every other built-in generator.
export function layeredBiomeGenerator(ctx) {
  const { width, height, biomes, seedCount, stamps = [] } = ctx.params ?? {};
  if (!width || !height) {
    throw new Error('layeredBiomeGenerator requires params.width and params.height');
  }

  const zone = createZone(width, height);
  const { entryPoint } = partitionBiomes(zone, ctx.rng, { biomes, seedCount });
  zone.anchors.push({ id: 'entry', x: entryPoint.x, y: entryPoint.y });

  // Feature layer: stamps applied after the base partition - this is the
  // "feature layers on top of a base biome layer" the design doc describes.
  const stampRecords = stamps.map((stamp) => stampTemplate(zone, stamp.template, stamp));

  // connect, not prune: a biome region (e.g. a water patch not meant to be
  // walkably adjacent to land) is deliberate content, so a disconnected
  // pocket gets a corridor rather than getting pruned away.
  ensureTraversable(zone, { entryPoints: [entryPoint], stamps: stampRecords, mode: 'connect' });

  return zone;
}
