import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import { loadPlugins, satisfiesRange, CORE_API_VERSION } from '../src/plugins.js';

test('satisfiesRange: caret allows same-major upgrades but not a major bump', () => {
  assert.equal(satisfiesRange('1.2.3', '^1.2.0'), true);
  assert.equal(satisfiesRange('1.9.9', '^1.2.0'), true);
  assert.equal(satisfiesRange('1.2.0', '^1.2.3'), false);
  assert.equal(satisfiesRange('2.0.0', '^1.2.0'), false);
});

test('satisfiesRange: caret on a 0.x version only allows same-minor upgrades', () => {
  assert.equal(satisfiesRange('0.5.9', '^0.5.0'), true);
  assert.equal(satisfiesRange('0.6.0', '^0.5.0'), false);
});

test('satisfiesRange: caret on a 0.0.x version requires an exact patch match', () => {
  assert.equal(satisfiesRange('0.0.3', '^0.0.3'), true);
  assert.equal(satisfiesRange('0.0.4', '^0.0.3'), false);
});

test('satisfiesRange: tilde allows patch bumps but not a minor bump', () => {
  assert.equal(satisfiesRange('1.2.9', '~1.2.0'), true);
  assert.equal(satisfiesRange('1.3.0', '~1.2.0'), false);
});

test('satisfiesRange: an exact range requires an identical version', () => {
  assert.equal(satisfiesRange('1.2.3', '1.2.3'), true);
  assert.equal(satisfiesRange('1.2.4', '1.2.3'), false);
});

test('loadPlugins calls register(api) on every plugin in dependency order, even out of declaration order', () => {
  const api = createApi();
  const order = [];

  const pluginA = { id: 'a', version: '1.0.0', dependencies: {}, register: () => order.push('a') };
  const pluginB = { id: 'b', version: '1.0.0', dependencies: { a: '^1.0.0' }, register: () => order.push('b') };

  const loadOrder = loadPlugins(api, [pluginB, pluginA]); // declared out of dependency order on purpose

  assert.deepEqual(order, ['a', 'b']);
  assert.deepEqual(loadOrder, ['a', 'b']);
});

test('loadPlugins throws for a missing dependency', () => {
  const api = createApi();
  const plugin = { id: 'a', version: '1.0.0', dependencies: { nonexistent: '^1.0.0' }, register: () => {} };

  assert.throws(() => loadPlugins(api, [plugin]));
});

test('loadPlugins throws for a dependency cycle', () => {
  const api = createApi();
  const pluginA = { id: 'a', version: '1.0.0', dependencies: { b: '^1.0.0' }, register: () => {} };
  const pluginB = { id: 'b', version: '1.0.0', dependencies: { a: '^1.0.0' }, register: () => {} };

  assert.throws(() => loadPlugins(api, [pluginA, pluginB]));
});

test('loadPlugins throws when a plugin-to-plugin version range is not satisfied', () => {
  const api = createApi();
  const pluginA = { id: 'a', version: '2.0.0', dependencies: {}, register: () => {} };
  const pluginB = { id: 'b', version: '1.0.0', dependencies: { a: '^1.0.0' }, register: () => {} };

  assert.throws(() => loadPlugins(api, [pluginA, pluginB]));
});

test('loadPlugins throws when a plugin requires an incompatible core version', () => {
  const api = createApi();
  const plugin = { id: 'a', version: '1.0.0', dependencies: { core: '^99.0.0' }, register: () => {} };

  assert.throws(() => loadPlugins(api, [plugin]));
});

test('loadPlugins accepts a compatible core dependency range using the default CORE_API_VERSION', () => {
  const api = createApi();
  let registered = false;
  const plugin = { id: 'a', version: '1.0.0', dependencies: { core: `^${CORE_API_VERSION}` }, register: () => { registered = true; } };

  loadPlugins(api, [plugin]);

  assert.equal(registered, true);
});

test('loadPlugins accepts an explicit coreApiVersion override', () => {
  const api = createApi();
  let registered = false;
  const plugin = { id: 'a', version: '1.0.0', dependencies: { core: '^2.0.0' }, register: () => { registered = true; } };

  loadPlugins(api, [plugin], { coreApiVersion: '2.1.0' });

  assert.equal(registered, true);
});

test('a loaded plugin\'s register(api) can use the full public api surface', () => {
  const api = createApi();
  const plugin = {
    id: 'goblin-pack',
    version: '1.0.0',
    dependencies: {},
    register: (loadedApi) => {
      loadedApi.registerEntity('goblin', { components: { Health: { current: 5, max: 5 } } });
    },
  };

  loadPlugins(api, [plugin]);
  const goblin = api.instantiateEntity('goblin');

  assert.deepEqual(api.getComponent(goblin, 'Health'), { current: 5, max: 5 });
});
