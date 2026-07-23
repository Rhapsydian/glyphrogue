import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingApi } from '../src/recordingApi.js';

test('a plugin\'s register(api) run against the recording api produces a manifest, mutating nothing real', () => {
  const { api, manifest } = createRecordingApi();

  function register(recordingApi) {
    recordingApi.registerEntity('torch', { components: { Flammable: {} } });
    recordingApi.registerEntityType('goblin', {
      components: { Health: {} },
      rules: [{ action: 'Death', handler: () => {} }],
    });
    recordingApi.registerRule('standalone-rule', 'Attack', () => {});
    recordingApi.registerGenerator('cave', () => {});
    recordingApi.registerScreen('inventory', {});
    recordingApi.registerSound('hit', { trigger: 'Attack' });
    recordingApi.registerScriptedEvent('ambush', {
      trigger: { action: 'EnterRegion' },
      steps: [{ do: [] }, { waitFor: { action: 'DefeatAll' } }],
    });
  }

  register(api);

  assert.deepEqual(manifest, [
    { kind: 'entity', id: 'torch', components: ['Flammable'] },
    { kind: 'entityType', id: 'goblin', components: ['Health'], rules: ['Death'] },
    { kind: 'rule', id: 'standalone-rule', actionType: 'Attack' },
    { kind: 'generator', id: 'cave' },
    { kind: 'screen', id: 'inventory' },
    { kind: 'sound', id: 'hit', trigger: 'Attack' },
    { kind: 'scriptedEvent', id: 'ambush', trigger: 'EnterRegion', steps: 2 },
  ]);
});

test('the manifest preserves call order across different kinds', () => {
  const { api, manifest } = createRecordingApi();

  api.registerRule('r1', 'Attack');
  api.registerGenerator('g1');
  api.registerRule('r2', 'Move');

  assert.deepEqual(manifest.map((entry) => entry.id), ['r1', 'g1', 'r2']);
});

test('each createRecordingApi() call gets an independent manifest', () => {
  const first = createRecordingApi();
  const second = createRecordingApi();

  first.api.registerGenerator('cave');

  assert.equal(first.manifest.length, 1);
  assert.equal(second.manifest.length, 0);
});
