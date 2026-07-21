import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { createZone, ensureTraversable } from '../src/zoneComposition.js';
import { partitionBiomes, layeredBiomeGenerator } from '../src/layeredBiome.js';

test('layeredBiomeGenerator is deterministic for a given seed', () => {
  const biomes = [{ id: 'grass', cell: 'grass' }, { id: 'water', cell: 'water' }];
  const a = layeredBiomeGenerator({ rng: createRng(1), params: { width: 15, height: 15, biomes } });
  const b = layeredBiomeGenerator({ rng: createRng(1), params: { width: 15, height: 15, biomes } });

  assert.deepEqual(a.cells, b.cells);
});

test('layeredBiomeGenerator produces a different layout for a different seed', () => {
  const biomes = [{ id: 'grass', cell: 'grass' }, { id: 'water', cell: 'water' }];
  const a = layeredBiomeGenerator({ rng: createRng(1), params: { width: 15, height: 15, biomes } });
  const b = layeredBiomeGenerator({ rng: createRng(2), params: { width: 15, height: 15, biomes } });

  assert.notDeepEqual(a.cells, b.cells);
});

test('layeredBiomeGenerator throws when width/height are missing', () => {
  const biomes = [{ id: 'grass', cell: 'grass' }];
  assert.throws(() => layeredBiomeGenerator({ rng: createRng(1), params: { biomes } }));
});

test('every declared biome appears across the zone with enough seeds', () => {
  const zone = createZone(20, 20);
  const biomes = [
    { id: 'grass', cell: 'grass' },
    { id: 'water', cell: 'water' },
    { id: 'lava', cell: 'lava' },
  ];

  partitionBiomes(zone, createRng(1), { biomes, seedCount: 12 });

  assert.equal(new Set(zone.cells).size, biomes.length);
});

test('a seedCount of 1 leaves every other declared biome unrepresented (documented behavior, not a bug)', () => {
  const zone = createZone(10, 10);
  const biomes = [
    { id: 'grass', cell: 'grass' },
    { id: 'water', cell: 'water' },
    { id: 'lava', cell: 'lava' },
  ];

  partitionBiomes(zone, createRng(1), { biomes, seedCount: 1 });

  // exactly one seed means every cell is nearest to it - only one biome's
  // cell value can possibly appear, regardless of which biome got picked
  assert.equal(new Set(zone.cells).size, 1);
});

test('partitionBiomes only partitions within the given region, leaving the rest of the zone untouched', () => {
  const zone = createZone(20, 10, 'untouched');
  const biomes = [{ id: 'grass', cell: 'grass' }];

  partitionBiomes(zone, createRng(1), { region: { x: 0, y: 0, width: 10, height: 10 }, biomes });

  for (let y = 0; y < 10; y++) {
    for (let x = 10; x < 20; x++) {
      assert.equal(zone.cells[y * 20 + x], 'untouched');
    }
  }
});

test('layeredBiomeGenerator auto-connects a stamp placed on the base partition', () => {
  const biomes = [{ id: 'grass', cell: 'grass' }];
  const template = { width: 1, height: 1, cells: ['floor'], entities: [], anchors: [], logicalLinks: [] };

  const zone = layeredBiomeGenerator({
    rng: createRng(1),
    params: { width: 12, height: 12, biomes, stamps: [{ template, x: 11, y: 11 }] },
  });

  const entry = zone.anchors.find((a) => a.id === 'entry');
  const reached = ensureTraversable(zone, { entryPoints: [entry], mode: 'prune' });

  assert.equal(zone.cells[11 * 12 + 11], 'floor');
  assert.ok(reached.has('11,11'));
});

test('layeredBiomeGenerator connects (rather than prunes) a disconnected biome patch the base partition produces', () => {
  // seed 2 with these exact params is verified to produce a floor patch
  // fully enclosed by a "blocked" biome, disconnected from (0,0) - a
  // genuine case for ensureTraversable's connect mode, not an incidental one.
  const biomes = [
    { id: 'open', cell: 'floor' },
    { id: 'blocked', cell: 'wall' },
  ];

  const raw = createZone(12, 12);
  partitionBiomes(raw, createRng(2), { biomes, seedCount: 8 });

  const zone = layeredBiomeGenerator({ rng: createRng(2), params: { width: 12, height: 12, biomes, seedCount: 8 } });

  // the generator must not have destroyed the raw partition's floor cells
  for (let i = 0; i < raw.cells.length; i++) {
    if (raw.cells[i] === 'floor') assert.equal(zone.cells[i], 'floor');
  }

  // ...and everything must now be mutually reachable from the entry point
  const entry = zone.anchors.find((a) => a.id === 'entry');
  const before = zone.cells.slice();
  ensureTraversable(zone, { entryPoints: [entry], mode: 'prune' });
  assert.deepEqual(zone.cells, before);
});
