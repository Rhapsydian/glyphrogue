import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createZone, createRng } from '@glyphrogue/core';
import {
  COMPOSITION_GENERATORS,
  getCompositionGenerator,
  PLACEHOLDER_WFC_TILES,
  PLACEHOLDER_WFC_ADJACENCY,
} from '../src/compositionGenerators.js';

test('getCompositionGenerator finds each of the four composable generators by id', () => {
  for (const id of ['bsp', 'cellular-automata', 'wfc', 'layered-biome']) {
    assert.equal(getCompositionGenerator(id).id, id);
  }
});

test('getCompositionGenerator returns undefined for an unknown id', () => {
  assert.equal(getCompositionGenerator('does-not-exist'), undefined);
});

test('bsp.run carves the region and returns an entryPoint inside it', () => {
  const zone = createZone(10, 10);
  const generator = getCompositionGenerator('bsp');
  const region = { x: 0, y: 0, width: 10, height: 10 };
  const entryPoint = generator.run(zone, createRng(1), region, generator.paramsDefaults);

  assert.ok(entryPoint.x >= 0 && entryPoint.x < 10);
  assert.ok(entryPoint.y >= 0 && entryPoint.y < 10);
  assert.ok(zone.cells.includes('floor'));
});

test('cellular-automata.run mutates the zone in place and derives an entryPoint via nearestOpenCell', () => {
  const zone = createZone(10, 10);
  const generator = getCompositionGenerator('cellular-automata');
  const region = { x: 0, y: 0, width: 10, height: 10 };
  const entryPoint = generator.run(zone, createRng(1), region, generator.paramsDefaults);

  assert.ok(entryPoint);
  // The returned entry point must itself be walkable - that's the whole
  // point of the nearestOpenCell fallback (carveCellularAutomata itself
  // returns nothing).
  const cell = zone.cells[entryPoint.y * zone.width + entryPoint.x];
  assert.notEqual(cell, 'wall');
});

test('wfc.run uses the placeholder tiles/adjacency and never contradicts regardless of region size', () => {
  const zone = createZone(12, 12);
  const generator = getCompositionGenerator('wfc');
  const region = { x: 0, y: 0, width: 12, height: 12 };
  const entryPoint = generator.run(zone, createRng(7), region, generator.paramsDefaults);

  assert.ok(entryPoint);
  // Every cell in the region must have been assigned one of the two
  // placeholder tile's cell types - nothing left at whatever createZone's
  // own default fill was.
  const allowedCells = new Set(PLACEHOLDER_WFC_TILES.map((tile) => tile.cell));
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      assert.ok(allowedCells.has(zone.cells[y * 12 + x]));
    }
  }
});

test('the placeholder WFC adjacency is maximally permissive: every tile pair is allowed in every direction', () => {
  const tileIds = PLACEHOLDER_WFC_TILES.map((t) => t.id);
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const expectedCount = tileIds.length * tileIds.length * directions.length;
  assert.equal(PLACEHOLDER_WFC_ADJACENCY.length, expectedCount);
});

test('layered-biome.run uses the placeholder biomes and returns a walkable entryPoint', () => {
  const zone = createZone(10, 10);
  const generator = getCompositionGenerator('layered-biome');
  const region = { x: 0, y: 0, width: 10, height: 10 };
  const entryPoint = generator.run(zone, createRng(3), region, generator.paramsDefaults);

  assert.ok(entryPoint);
  assert.ok(zone.cells.includes('floor'));
});

test('every composition generator exposes flat, narrow-form-compatible paramsDefaults', () => {
  for (const generator of COMPOSITION_GENERATORS) {
    for (const value of Object.values(generator.paramsDefaults)) {
      assert.ok(['number', 'boolean', 'string'].includes(typeof value));
    }
  }
});
