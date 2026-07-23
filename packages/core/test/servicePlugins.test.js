import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import { loadPlugins } from '../src/plugins.js';
import { has } from '../src/registry.js';
import { MEMORY_COMPONENT } from '../src/memory.js';
import { memoryPlugin, audioLoaderPlugin } from '../src/servicePlugins.js';

function createFakeAudioContext() {
  const decodeCalls = [];
  return {
    decodeCalls,
    decodeAudioData(arrayBuffer) {
      decodeCalls.push(arrayBuffer);
      return Promise.resolve({ id: 'decoded', from: arrayBuffer });
    },
  };
}

test('memoryPlugin exposes api.ensureMemory/api.updateEntityMemory bound to the live api', () => {
  const api = createApi();
  loadPlugins(api, [memoryPlugin]);

  const entity = api.createEntity();
  const memory = api.ensureMemory(entity);

  assert.deepEqual(memory.remembered, new Set());
  assert.ok(api.hasComponent(entity, MEMORY_COMPONENT));

  api.updateEntityMemory(entity, new Set(['0,0']), new Map());
  assert.deepEqual([...api.getComponent(entity, MEMORY_COMPONENT).remembered], ['0,0']);
});

test('memoryPlugin registers under service id "memory", not a content id', () => {
  const api = createApi();
  loadPlugins(api, [memoryPlugin]);

  assert.equal(typeof api.ensureMemory, 'function');
  assert.equal(has(api.registry, 'memory'), false);
});

test('audioLoaderPlugin exposes api.loadBuffer/api.getBuffer bound to a loader it builds itself', async () => {
  const api = createApi();
  loadPlugins(api, [audioLoaderPlugin]);

  const audioCtx = createFakeAudioContext();
  const buffer = await api.loadBuffer(audioCtx, 'clang', { id: 'raw-bytes' });

  assert.deepEqual(buffer, { id: 'decoded', from: { id: 'raw-bytes' } });
  assert.equal(api.getBuffer('clang'), buffer);
  assert.equal(audioCtx.decodeCalls.length, 1);
});

test('audioLoaderPlugin caches across repeat api.loadBuffer calls', async () => {
  const api = createApi();
  loadPlugins(api, [audioLoaderPlugin]);

  const audioCtx = createFakeAudioContext();
  const first = await api.loadBuffer(audioCtx, 'clang', { id: 'raw-bytes' });
  const second = await api.loadBuffer(audioCtx, 'clang', { id: 'different-bytes' });

  assert.equal(second, first);
  assert.equal(audioCtx.decodeCalls.length, 1);
});

test('two createApi() instances loading audioLoaderPlugin get independent loaders', async () => {
  const apiA = createApi();
  const apiB = createApi();
  loadPlugins(apiA, [audioLoaderPlugin]);
  loadPlugins(apiB, [audioLoaderPlugin]);

  await apiA.loadBuffer(createFakeAudioContext(), 'clang', { id: 'a' });

  assert.equal(apiA.getBuffer('clang') !== undefined, true);
  assert.equal(apiB.getBuffer('clang'), undefined);
});

test('both service plugins declare a core version dependency', () => {
  for (const plugin of [memoryPlugin, audioLoaderPlugin]) {
    assert.equal(plugin.version, '1.0.0');
    assert.ok(plugin.dependencies.core);
  }
});
