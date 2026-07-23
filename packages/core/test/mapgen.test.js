import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/registry.js';
import { registerGenerator, generateZone } from '../src/mapgen.js';

function stubGenerator(ctx) {
  return {
    width: 3,
    height: 3,
    cells: Array.from({ length: 9 }, () => (ctx.rng.next() < 0.5 ? 'wall' : 'floor')),
    entities: [],
    anchors: [],
    logicalLinks: [],
    paramsSeen: ctx.params,
    neighborLookupSeen: ctx.getNeighborZone,
  };
}

test('generateZone looks up the registered generator and returns its ZoneDTO', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator);

  const zone = generateZone(registry, { generatorId: 'stub', worldSeed: 1, zoneId: 'a' });

  assert.equal(zone.width, 3);
  assert.equal(zone.height, 3);
  assert.equal(zone.cells.length, 9);
});

test('generateZone throws for an unregistered generator id', () => {
  const registry = createRegistry();
  assert.throws(() => generateZone(registry, { generatorId: 'missing', worldSeed: 1, zoneId: 'a' }));
});

test('the same (worldSeed, zoneId) regenerates an identical zone', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator);

  const a = generateZone(registry, { generatorId: 'stub', worldSeed: 42, zoneId: 'zone-1' });
  const b = generateZone(registry, { generatorId: 'stub', worldSeed: 42, zoneId: 'zone-1' });

  assert.deepEqual(a.cells, b.cells);
});

test('a different zoneId produces a different zone', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator);

  const a = generateZone(registry, { generatorId: 'stub', worldSeed: 42, zoneId: 'zone-1' });
  const b = generateZone(registry, { generatorId: 'stub', worldSeed: 42, zoneId: 'zone-2' });

  assert.notDeepEqual(a.cells, b.cells);
});

test('a different worldSeed produces a different zone for the same zoneId', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator);

  const a = generateZone(registry, { generatorId: 'stub', worldSeed: 1, zoneId: 'zone-1' });
  const b = generateZone(registry, { generatorId: 'stub', worldSeed: 2, zoneId: 'zone-1' });

  assert.notDeepEqual(a.cells, b.cells);
});

test('params and getNeighborZone are passed through to the GenerationContext untouched', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator);

  const params = { biome: 'cave' };
  const getNeighborZone = (id) => ({ id });

  const zone = generateZone(registry, {
    generatorId: 'stub',
    worldSeed: 1,
    zoneId: 'a',
    params,
    getNeighborZone,
  });

  assert.equal(zone.paramsSeen, params);
  assert.equal(zone.neighborLookupSeen, getNeighborZone);
});

test('getNeighborZone is undefined-safe when the caller supplies none', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator);

  const zone = generateZone(registry, { generatorId: 'stub', worldSeed: 1, zoneId: 'a' });

  assert.equal(zone.neighborLookupSeen, undefined);
});

test('paramsDefaults fills in a field omitted from params', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator, {
    paramsDefaults: { minPartitionSize: 6, roomMargin: 1 },
  });

  const zone = generateZone(registry, {
    generatorId: 'stub',
    worldSeed: 1,
    zoneId: 'a',
    params: { roomMargin: 2 },
  });

  assert.deepEqual(zone.paramsSeen, { minPartitionSize: 6, roomMargin: 2 });
});

test('a field provided in params overrides its paramsDefaults value', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator, {
    paramsDefaults: { minPartitionSize: 6 },
  });

  const zone = generateZone(registry, {
    generatorId: 'stub',
    worldSeed: 1,
    zoneId: 'a',
    params: { minPartitionSize: 12 },
  });

  assert.equal(zone.paramsSeen.minPartitionSize, 12);
});

test('a generator registered with no paramsDefaults behaves exactly as before', () => {
  const registry = createRegistry();
  registerGenerator(registry, 'stub', stubGenerator);

  const zone = generateZone(registry, {
    generatorId: 'stub',
    worldSeed: 1,
    zoneId: 'a',
    params: { biome: 'cave' },
  });

  assert.deepEqual(zone.paramsSeen, { biome: 'cave' });
});
