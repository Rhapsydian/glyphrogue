import { carveBsp, carveCellularAutomata, collapseWfc, partitionBiomes, nearestOpenCell } from '@glyphrogue/core';

// TESTING BOILERPLATE, not an authoring surface: collapseWfc/partitionBiomes
// both require author-declared data (docs/design/editor.md never scoped a
// tiles/biomes authoring UI - that's a future, separately-scoped item) so
// these are fixed placeholders, not something an author can edit here. WFC's
// adjacency is generated as a maximally-permissive "any tile next to any
// tile" ruleset specifically so collapseWfc can never contradict regardless
// of region size - a real ruleset would be far more restrictive.
export const PLACEHOLDER_WFC_TILES = [
  { id: 'floor', cell: 'floor', weight: 3 },
  { id: 'wall', cell: 'wall', weight: 1 },
];

const WFC_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const PLACEHOLDER_WFC_ADJACENCY = WFC_DIRECTIONS.flatMap(([dx, dy]) =>
  PLACEHOLDER_WFC_TILES.flatMap(({ id: a }) => PLACEHOLDER_WFC_TILES.map(({ id: b }) => ({ a, b, dx, dy })))
);

export const PLACEHOLDER_BIOMES = [
  { cell: 'floor', weight: 2 },
  { cell: 'wall', weight: 1 },
];

// The four region-scoped primitives packages/core exports for composition,
// each wrapped to a uniform (zone, rng, region, params) => entryPoint shape
// so compositionSteps.js's composeZone/generateComposedSource can treat
// every step the same way. carveBsp/collapseWfc/partitionBiomes return an
// entryPoint directly; carveCellularAutomata mutates in place and returns
// nothing, so its entry point is derived the same way
// cellularAutomataGenerator's own wrapper already does (nearestOpenCell).
// paramsDefaults mirrors each primitive's own internal defaults (bsp.js's
// DEFAULT_MIN_PARTITION_SIZE/DEFAULT_ROOM_MARGIN, zoneComposition.js's
// DEFAULT_FILL_PROBABILITY/DEFAULT_PASSES/DEFAULT_WALL_THRESHOLD,
// waveFunctionCollapse.js's DEFAULT_MAX_RETRIES) - not imported, since none
// of those constants are re-exported from index.js, only literal-matched.
export const COMPOSITION_GENERATORS = [
  {
    id: 'bsp',
    label: 'BSP',
    paramsDefaults: { minPartitionSize: 6, roomMargin: 1 },
    run: (zone, rng, region, params) => carveBsp(zone, rng, { region, ...params }).entryPoint,
  },
  {
    id: 'cellular-automata',
    label: 'Cellular automata',
    paramsDefaults: { fillProbability: 0.45, passes: 4, wallThreshold: 5 },
    run: (zone, rng, region, params) => {
      carveCellularAutomata(zone, rng, { region, ...params });
      return nearestOpenCell(zone, region);
    },
  },
  {
    id: 'wfc',
    label: 'Wave function collapse',
    paramsDefaults: { maxRetries: 50 },
    run: (zone, rng, region, params) =>
      collapseWfc(zone, rng, {
        region,
        tiles: PLACEHOLDER_WFC_TILES,
        adjacency: PLACEHOLDER_WFC_ADJACENCY,
        ...params,
      }).entryPoint,
  },
  {
    id: 'layered-biome',
    label: 'Layered biome',
    paramsDefaults: { seedCount: PLACEHOLDER_BIOMES.length * 2 },
    run: (zone, rng, region, params) =>
      partitionBiomes(zone, rng, { region, biomes: PLACEHOLDER_BIOMES, ...params }).entryPoint,
  },
];

export function getCompositionGenerator(id) {
  return COMPOSITION_GENERATORS.find((generator) => generator.id === id);
}
