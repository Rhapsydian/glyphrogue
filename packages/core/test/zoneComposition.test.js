import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { createZone, stampTemplate, carveCellularAutomata } from '../src/zoneComposition.js';

function makeTemplate() {
  // 2x1 template: a door (anchor) at (0,0), a floor at (1,0).
  return {
    width: 2,
    height: 1,
    cells: ['door', 'floor'],
    entities: [{ type: 'chest', x: 1, y: 0, data: {} }],
    anchors: [{ id: 'door', x: 0, y: 0 }],
    logicalLinks: [],
  };
}

test('createZone builds a ZoneDTO-shaped grid filled with the given cell', () => {
  const zone = createZone(3, 2, 'wall');
  assert.equal(zone.width, 3);
  assert.equal(zone.height, 2);
  assert.deepEqual(zone.cells, ['wall', 'wall', 'wall', 'wall', 'wall', 'wall']);
  assert.deepEqual(zone.entities, []);
});

test('stampTemplate at rotation 0 places cells/entities/anchors at the given offset', () => {
  const zone = createZone(4, 4, 'wall');
  const stamp = stampTemplate(zone, makeTemplate(), { x: 1, y: 1, rotation: 0 });

  assert.equal(zone.cells[1 * 4 + 1], 'door');
  assert.equal(zone.cells[1 * 4 + 2], 'floor');
  assert.deepEqual(zone.entities, [{ type: 'chest', x: 2, y: 1, data: {} }]);
  assert.deepEqual(stamp.anchors, [{ id: 'door', x: 1, y: 1 }]);
  assert.deepEqual(stamp.bounds, { x: 1, y: 1, width: 2, height: 1 });
});

test('stampTemplate at rotation 90 swaps the footprint dimensions', () => {
  const zone = createZone(4, 4, 'wall');
  const stamp = stampTemplate(zone, makeTemplate(), { x: 0, y: 0, rotation: 90 });

  assert.deepEqual(stamp.bounds, { x: 0, y: 0, width: 1, height: 2 });
});

test('stampTemplate carries mayBeIsolated and reachableVia through to the stamp record', () => {
  const zone = createZone(4, 4, 'wall');
  const stamp = stampTemplate(zone, makeTemplate(), { x: 0, y: 0, mayBeIsolated: true, reachableVia: 'link-1' });

  assert.equal(stamp.mayBeIsolated, true);
  assert.equal(stamp.reachableVia, 'link-1');
});

test('stamping twice does not clobber cells outside either template footprint', () => {
  const zone = createZone(5, 1, 'wall');
  stampTemplate(zone, makeTemplate(), { x: 0, y: 0 });
  stampTemplate(zone, makeTemplate(), { x: 3, y: 0 });

  assert.deepEqual(zone.cells, ['door', 'floor', 'wall', 'door', 'floor']);
});

test('carveCellularAutomata is deterministic for a given seed', () => {
  const zoneA = createZone(10, 10);
  carveCellularAutomata(zoneA, createRng(5));

  const zoneB = createZone(10, 10);
  carveCellularAutomata(zoneB, createRng(5));

  assert.deepEqual(zoneA.cells, zoneB.cells);
});

test('carveCellularAutomata produces a different result for a different seed', () => {
  const zoneA = createZone(10, 10);
  carveCellularAutomata(zoneA, createRng(5));

  const zoneB = createZone(10, 10);
  carveCellularAutomata(zoneB, createRng(6));

  assert.notDeepEqual(zoneA.cells, zoneB.cells);
});

test('carveCellularAutomata only touches its region, leaving the rest of the zone untouched', () => {
  const zone = createZone(6, 6, 'untouched');
  carveCellularAutomata(zone, createRng(1), { region: { x: 1, y: 1, width: 2, height: 2 } });

  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const inRegion = x >= 1 && x < 3 && y >= 1 && y < 3;
      if (!inRegion) {
        assert.equal(zone.cells[y * 6 + x], 'untouched');
      }
    }
  }
});
