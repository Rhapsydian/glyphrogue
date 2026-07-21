import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/registry.js';
import { registerGenerator, generateZone } from '../src/mapgen.js';
import { applyDiff, loadZone } from '../src/zoneDiff.js';

function makeRegistry() {
  const registry = createRegistry();
  registerGenerator(registry, 'flat', () => ({
    width: 3,
    height: 1,
    cells: ['wall', 'floor', 'wall'],
    entities: [{ type: 'goblin', x: 1, y: 0, data: { hp: 5 } }],
    anchors: [],
    logicalLinks: [],
  }));
  return registry;
}

test('applyDiff applies a cellOverride onto a generated zone', () => {
  const zone = generateZone(makeRegistry(), { generatorId: 'flat', worldSeed: 1, zoneId: 'a' });
  applyDiff(zone, { cellOverrides: [{ x: 0, y: 0, cell: 'floor' }] });

  assert.equal(zone.cells[0], 'floor');
});

test('applyDiff add/remove/modify entityDiffs', () => {
  const zone = generateZone(makeRegistry(), { generatorId: 'flat', worldSeed: 1, zoneId: 'a' });

  applyDiff(zone, {
    entityDiffs: [
      { op: 'modify', match: { type: 'goblin', x: 1, y: 0 }, data: { hp: 1 } },
      { op: 'add', entity: { type: 'chest', x: 2, y: 0, data: {} } },
    ],
  });

  assert.deepEqual(zone.entities, [
    { type: 'goblin', x: 1, y: 0, data: { hp: 1 } },
    { type: 'chest', x: 2, y: 0, data: {} },
  ]);

  applyDiff(zone, { entityDiffs: [{ op: 'remove', match: { type: 'goblin', x: 1, y: 0 } }] });

  assert.deepEqual(zone.entities, [{ type: 'chest', x: 2, y: 0, data: {} }]);
});

test('applyDiff throws for an unknown entityDiff op', () => {
  const zone = generateZone(makeRegistry(), { generatorId: 'flat', worldSeed: 1, zoneId: 'a' });
  assert.throws(() => applyDiff(zone, { entityDiffs: [{ op: 'teleport' }] }));
});

test('loadZone regenerates from seed then reapplies the diff', () => {
  const zone = loadZone(makeRegistry(), {
    generatorId: 'flat',
    worldSeed: 1,
    zoneId: 'a',
    diff: { cellOverrides: [{ x: 0, y: 0, cell: 'floor' }] },
  });

  assert.deepEqual(zone.cells, ['floor', 'floor', 'wall']);
});

test('loadZone is deterministic: same args reproduce an identical zone', () => {
  const diff = { cellOverrides: [{ x: 2, y: 0, cell: 'floor' }] };
  const a = loadZone(makeRegistry(), { generatorId: 'flat', worldSeed: 7, zoneId: 'z9', diff });
  const b = loadZone(makeRegistry(), { generatorId: 'flat', worldSeed: 7, zoneId: 'z9', diff });

  assert.deepEqual(a, b);
});

test('the diff survives independently of regeneration - a fresh (undiffed) generate differs from the loaded zone', () => {
  const registry = makeRegistry();
  const fresh = generateZone(registry, { generatorId: 'flat', worldSeed: 1, zoneId: 'a' });
  const loaded = loadZone(registry, {
    generatorId: 'flat',
    worldSeed: 1,
    zoneId: 'a',
    diff: { cellOverrides: [{ x: 0, y: 0, cell: 'floor' }] },
  });

  assert.equal(fresh.cells[0], 'wall');
  assert.equal(loaded.cells[0], 'floor');
});
