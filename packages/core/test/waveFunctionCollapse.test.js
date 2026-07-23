import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { createZone, ensureTraversable } from '../src/zoneComposition.js';
import { collapseWfc, wfcGenerator, DEFAULT_MAX_RETRIES } from '../src/waveFunctionCollapse.js';
import { createRegistry } from '../src/registry.js';
import { registerGenerator, generateZone } from '../src/mapgen.js';

function allDirectionAdjacency(pairs) {
  const adjacency = [];
  for (const [a, b] of pairs) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      adjacency.push({ a, b, dx, dy });
    }
  }
  return adjacency;
}

test('collapseWfc enforces a strict 2-tile checkerboard adjacency', () => {
  const width = 6;
  const height = 6;
  const zone = createZone(width, height);
  const tiles = [
    { id: 'A', cell: 'floor' },
    { id: 'B', cell: 'wall' },
  ];
  const adjacency = allDirectionAdjacency([['A', 'B'], ['B', 'A']]);

  collapseWfc(zone, createRng(1), { tiles, adjacency });

  const originCell = zone.cells[0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const expectSame = (x + y) % 2 === 0;
      const actual = zone.cells[y * width + x];
      if (expectSame) assert.equal(actual, originCell);
      else assert.notEqual(actual, originCell);
    }
  }
});

test('collapseWfc respects declared adjacency: water and lava never end up adjacent', () => {
  const width = 8;
  const height = 8;
  const zone = createZone(width, height);
  const tiles = [
    { id: 'water', cell: 'water' },
    { id: 'sand', cell: 'sand' },
    { id: 'lava', cell: 'lava' },
  ];
  const adjacency = allDirectionAdjacency([
    ['water', 'water'],
    ['water', 'sand'],
    ['sand', 'water'],
    ['sand', 'sand'],
    ['sand', 'lava'],
    ['lava', 'sand'],
    ['lava', 'lava'],
  ]);

  collapseWfc(zone, createRng(3), { tiles, adjacency });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = zone.cells[y * width + x];
      for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
        if (nx >= width || ny >= height) continue;
        const neighbor = zone.cells[ny * width + nx];
        assert.ok(!(cell === 'water' && neighbor === 'lava'));
        assert.ok(!(cell === 'lava' && neighbor === 'water'));
      }
    }
  }
});

test('collapseWfc is deterministic for a given seed', () => {
  const tiles = [{ id: 'A', cell: 'floor' }, { id: 'B', cell: 'wall' }];
  const adjacency = allDirectionAdjacency([['A', 'B'], ['B', 'A']]);

  const zoneA = createZone(8, 8);
  collapseWfc(zoneA, createRng(11), { tiles, adjacency });
  const zoneB = createZone(8, 8);
  collapseWfc(zoneB, createRng(11), { tiles, adjacency });

  assert.deepEqual(zoneA.cells, zoneB.cells);
});

test('collapseWfc throws after exhausting maxRetries on an unsatisfiable ruleset', () => {
  const zone = createZone(3, 3);
  const tiles = [{ id: 'A', cell: 'floor' }, { id: 'B', cell: 'wall' }];

  assert.throws(() => collapseWfc(zone, createRng(1), { tiles, adjacency: [], maxRetries: 3 }));
});

test('collapseWfc only collapses within the given region, leaving the rest of the zone untouched', () => {
  const zone = createZone(10, 6, 'untouched');
  const tiles = [{ id: 'A', cell: 'floor' }];
  const adjacency = allDirectionAdjacency([['A', 'A']]);

  collapseWfc(zone, createRng(1), { region: { x: 0, y: 0, width: 5, height: 6 }, tiles, adjacency });

  for (let y = 0; y < 6; y++) {
    for (let x = 5; x < 10; x++) {
      assert.equal(zone.cells[y * 10 + x], 'untouched');
    }
  }
});

test('wfcGenerator throws when width/height are missing', () => {
  assert.throws(() => wfcGenerator({ rng: createRng(1), params: { tiles: [{ id: 'A', cell: 'floor' }] } }));
});

test('wfcGenerator connects rather than prunes the disconnected pockets a strict checkerboard collapse produces', () => {
  const tiles = [{ id: 'A', cell: 'floor' }, { id: 'B', cell: 'wall' }];
  const adjacency = allDirectionAdjacency([['A', 'B'], ['B', 'A']]);

  const raw = createZone(6, 6);
  collapseWfc(raw, createRng(2), { tiles, adjacency });

  const zone = wfcGenerator({ rng: createRng(2), params: { width: 6, height: 6, tiles, adjacency } });

  for (let i = 0; i < raw.cells.length; i++) {
    if (raw.cells[i] === 'floor') assert.equal(zone.cells[i], 'floor');
  }

  const entry = zone.anchors.find((a) => a.id === 'entry');
  const before = zone.cells.slice();
  ensureTraversable(zone, { entryPoints: [entry], mode: 'prune' });
  assert.deepEqual(zone.cells, before);
});

test('wfcGenerator auto-connects a stamp placed on the checkerboard collapse', () => {
  const tiles = [{ id: 'A', cell: 'floor' }, { id: 'B', cell: 'wall' }];
  const adjacency = allDirectionAdjacency([['A', 'B'], ['B', 'A']]);
  const template = { width: 1, height: 1, cells: ['floor'], entities: [], anchors: [], logicalLinks: [] };

  const zone = wfcGenerator({
    rng: createRng(5),
    params: { width: 8, height: 8, tiles, adjacency, stamps: [{ template, x: 7, y: 7 }] },
  });

  const entry = zone.anchors.find((a) => a.id === 'entry');
  const reached = ensureTraversable(zone, { entryPoints: [entry], mode: 'prune' });

  assert.equal(zone.cells[7 * 8 + 7], 'floor');
  assert.ok(reached.has('7,7'));
});

test('registerGenerator paramsDefaults built from waveFunctionCollapse.js\'s exported DEFAULT_MAX_RETRIES flows through generateZone', () => {
  const tiles = [{ id: 'A', cell: 'floor' }, { id: 'B', cell: 'wall' }];
  const adjacency = allDirectionAdjacency([['A', 'B'], ['B', 'A']]);
  const registry = createRegistry();
  registerGenerator(registry, 'wfc', wfcGenerator, {
    paramsDefaults: { maxRetries: DEFAULT_MAX_RETRIES },
  });

  const withOmittedField = generateZone(registry, {
    generatorId: 'wfc',
    worldSeed: 2,
    zoneId: 'a',
    params: { width: 6, height: 6, tiles, adjacency },
  });
  const withExplicitSameValue = generateZone(registry, {
    generatorId: 'wfc',
    worldSeed: 2,
    zoneId: 'a',
    params: { width: 6, height: 6, tiles, adjacency, maxRetries: DEFAULT_MAX_RETRIES },
  });

  assert.deepEqual(withOmittedField.cells, withExplicitSameValue.cells);
});
