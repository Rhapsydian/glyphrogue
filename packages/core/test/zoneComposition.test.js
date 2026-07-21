import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import {
  createZone,
  stampTemplate,
  carveCellularAutomata,
  connectCorridor,
  runConnectivityPass,
} from '../src/zoneComposition.js';

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

test('connectCorridor carves an L-shaped floor path between two points', () => {
  const zone = createZone(5, 5, 'wall');
  connectCorridor(zone, { x: 0, y: 0 }, { x: 3, y: 2 });

  // horizontal leg along y=0, then vertical leg along x=3
  for (let x = 0; x <= 3; x++) assert.equal(zone.cells[0 * 5 + x], 'floor');
  for (let y = 0; y <= 2; y++) assert.equal(zone.cells[y * 5 + 3], 'floor');
});

test('connectCorridor leaves non-wall cells (e.g. a door) alone at the endpoints', () => {
  const zone = createZone(3, 1, 'wall');
  zone.cells[0] = 'door';
  connectCorridor(zone, { x: 0, y: 0 }, { x: 2, y: 0 });

  assert.equal(zone.cells[0], 'door');
});

test('runConnectivityPass auto-connects an isolated stamped vault', () => {
  const zone = createZone(7, 1, 'wall');
  zone.cells[0] = 'floor'; // entry point at (0,0)
  const stamp = {
    anchors: [],
    bounds: { x: 5, y: 0, width: 2, height: 1 },
    mayBeIsolated: false,
    reachableVia: undefined,
  };
  zone.cells[5] = 'floor';
  zone.cells[6] = 'floor';

  const reached = runConnectivityPass(zone, { entryPoints: [{ x: 0, y: 0 }], stamps: [stamp] });

  assert.ok(reached.has('5,0'));
  // the gap between the entry and the vault must now be carved through
  for (let x = 1; x <= 4; x++) assert.equal(zone.cells[x], 'floor');
});

test('runConnectivityPass leaves a mayBeIsolated stamp disconnected', () => {
  const zone = createZone(7, 1, 'wall');
  zone.cells[0] = 'floor';
  zone.cells[5] = 'floor';
  zone.cells[6] = 'floor';
  const stamp = { anchors: [], bounds: { x: 5, y: 0, width: 2, height: 1 }, mayBeIsolated: true };

  runConnectivityPass(zone, { entryPoints: [{ x: 0, y: 0 }], stamps: [stamp] });

  // no corridor carved through the wall gap
  assert.equal(zone.cells[3], 'wall');
});

test('runConnectivityPass confirms a reachableVia stamp without carving a corridor', () => {
  const zone = createZone(7, 1, 'wall');
  zone.cells[0] = 'floor'; // entry, physically walled off from the vault
  zone.cells[5] = 'floor';
  zone.cells[6] = 'floor';
  // the link's "from" cell (3,0) is itself an unreached wall cell (a hidden
  // teleporter pad) - it never gets visited by the physical flood fill, so
  // this only reaches the vault if reachableVia is trusted outright.
  zone.logicalLinks = [{ id: 'teleporter-1', from: { x: 3, y: 0 }, to: { x: 5, y: 0 }, bidirectional: false }];
  const stamp = { anchors: [], bounds: { x: 5, y: 0, width: 2, height: 1 }, mayBeIsolated: false, reachableVia: 'teleporter-1' };

  runConnectivityPass(zone, { entryPoints: [{ x: 0, y: 0 }], stamps: [stamp] });

  // the physical gap stays uncarved - the stamp is trusted reachable via the link
  assert.equal(zone.cells[3], 'wall');
});

test('runConnectivityPass throws when reachableVia names a link that does not exist', () => {
  const zone = createZone(3, 1, 'wall');
  zone.cells[0] = 'floor';
  const stamp = { anchors: [], bounds: { x: 2, y: 0, width: 1, height: 1 }, mayBeIsolated: false, reachableVia: 'missing-link' };

  assert.throws(() => runConnectivityPass(zone, { entryPoints: [{ x: 0, y: 0 }], stamps: [stamp] }));
});

test('runConnectivityPass prefers a declared anchor over the nearest open cell', () => {
  const zone = createZone(6, 4, 'wall');
  zone.cells[0 * 6 + 0] = 'floor'; // entry at (0,0)
  zone.cells[3 * 6 + 2] = 'floor'; // an already-open cell in the bounds - the naive "nearest open cell" pick
  // anchor (a doorway not yet carved) at (5,3), in the same bounds
  const stamp = {
    anchors: [{ id: 'door', x: 5, y: 3 }],
    bounds: { x: 2, y: 3, width: 4, height: 1 },
    mayBeIsolated: false,
  };

  runConnectivityPass(zone, { entryPoints: [{ x: 0, y: 0 }], stamps: [stamp] });

  // the corridor's vertical leg must run down column x=5 (to the anchor),
  // not column x=2 (the nearest-open-cell fallback it would use if no
  // anchor were declared)
  assert.equal(zone.cells[3 * 6 + 5], 'floor');
  assert.equal(zone.cells[1 * 6 + 2], 'wall');
});
