import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import { loadPlugins } from '../src/plugins.js';
import { get } from '../src/registry.js';
import { DEFAULT_MIN_PARTITION_SIZE, DEFAULT_ROOM_MARGIN } from '../src/bsp.js';
import { DEFAULT_MAX_RETRIES } from '../src/waveFunctionCollapse.js';
import {
  bspPlugin,
  cellularAutomataPlugin,
  wfcPlugin,
  layeredBiomePlugin,
} from '../src/generatorPlugins.js';

test('bspPlugin registers bspGenerator under id "bsp", usable via api.generateZone', () => {
  const api = createApi();
  loadPlugins(api, [bspPlugin]);

  const zone = api.generateZone({ generatorId: 'bsp', zoneId: 'z1', params: { width: 20, height: 20 } });

  assert.equal(zone.width, 20);
  assert.equal(zone.height, 20);
  assert.ok(zone.anchors.some((anchor) => anchor.id === 'entry'));
});

test('cellularAutomataPlugin registers cellularAutomataGenerator under id "cellular-automata"', () => {
  const api = createApi();
  loadPlugins(api, [cellularAutomataPlugin]);

  const zone = api.generateZone({
    generatorId: 'cellular-automata',
    zoneId: 'z1',
    params: { width: 15, height: 15 },
  });

  assert.equal(zone.width, 15);
  assert.equal(zone.height, 15);
});

test('wfcPlugin registers wfcGenerator under id "wfc"', () => {
  const api = createApi();
  loadPlugins(api, [wfcPlugin]);

  const tiles = [{ id: 'A', cell: 'floor' }];
  const adjacency = [
    { a: 'A', b: 'A', dx: 1, dy: 0 },
    { a: 'A', b: 'A', dx: -1, dy: 0 },
    { a: 'A', b: 'A', dx: 0, dy: 1 },
    { a: 'A', b: 'A', dx: 0, dy: -1 },
  ];

  const zone = api.generateZone({
    generatorId: 'wfc',
    zoneId: 'z1',
    params: { width: 6, height: 6, tiles, adjacency },
  });

  assert.equal(zone.width, 6);
  assert.equal(zone.height, 6);
});

test('layeredBiomePlugin registers layeredBiomeGenerator under id "layered-biome"', () => {
  const api = createApi();
  loadPlugins(api, [layeredBiomePlugin]);

  const biomes = [{ id: 'grass', cell: 'grass' }, { id: 'water', cell: 'water' }];
  const zone = api.generateZone({
    generatorId: 'layered-biome',
    zoneId: 'z1',
    params: { width: 15, height: 15, biomes },
  });

  assert.equal(zone.width, 15);
  assert.equal(zone.height, 15);
  assert.ok(zone.anchors.some((anchor) => anchor.id === 'entry'));
});

test('bspPlugin registers paramsDefaults from bsp.js\'s extracted constants', () => {
  const api = createApi();
  loadPlugins(api, [bspPlugin]);

  const entry = get(api.registry, 'bsp');
  assert.deepEqual(entry.paramsDefaults, {
    minPartitionSize: DEFAULT_MIN_PARTITION_SIZE,
    roomMargin: DEFAULT_ROOM_MARGIN,
  });
});

test('wfcPlugin registers paramsDefaults from waveFunctionCollapse.js\'s extracted constant', () => {
  const api = createApi();
  loadPlugins(api, [wfcPlugin]);

  const entry = get(api.registry, 'wfc');
  assert.deepEqual(entry.paramsDefaults, { maxRetries: DEFAULT_MAX_RETRIES });
});

test('cellularAutomataPlugin and layeredBiomePlugin register no paramsDefaults', () => {
  const api = createApi();
  loadPlugins(api, [cellularAutomataPlugin, layeredBiomePlugin]);

  assert.equal(get(api.registry, 'cellular-automata').paramsDefaults, undefined);
  assert.equal(get(api.registry, 'layered-biome').paramsDefaults, undefined);
});

test('all four generator plugins declare a core version dependency', () => {
  for (const plugin of [bspPlugin, cellularAutomataPlugin, wfcPlugin, layeredBiomePlugin]) {
    assert.equal(plugin.version, '1.0.0');
    assert.ok(plugin.dependencies.core);
  }
});
