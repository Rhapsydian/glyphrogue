import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_PLUGINS } from '../src/corePlugins.js';
import { bspPlugin, cellularAutomataPlugin, wfcPlugin, layeredBiomePlugin } from '../src/generatorPlugins.js';
import { wandersPlugin, chasesPlayerPlugin, fleesPlugin, guardsPlugin } from '../src/behaviorPlugins.js';
import { memoryPlugin, audioLoaderPlugin } from '../src/servicePlugins.js';

test('CORE_PLUGINS lists all ten bundled plugins, each with a unique id', () => {
  assert.equal(CORE_PLUGINS.length, 10);
  assert.equal(new Set(CORE_PLUGINS.map((plugin) => plugin.id)).size, 10);
});

test('CORE_PLUGINS is exactly the union of the generator/behavior/service plugin modules', () => {
  const expected = [
    bspPlugin,
    cellularAutomataPlugin,
    wfcPlugin,
    layeredBiomePlugin,
    wandersPlugin,
    chasesPlayerPlugin,
    fleesPlugin,
    guardsPlugin,
    memoryPlugin,
    audioLoaderPlugin,
  ];
  assert.deepEqual(CORE_PLUGINS, expected);
});
