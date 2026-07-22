import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/registry.js';
import { registerScreen, getScreen } from '../src/screen.js';
import { createApi } from '../src/api.js';

test('registerScreen/getScreen round-trip a definition by id', () => {
  const registry = createRegistry();
  const definition = { render: () => {}, onOpen: () => {}, onClose: () => {} };

  registerScreen(registry, 'core:dialogue', definition);

  assert.equal(getScreen(registry, 'core:dialogue'), definition);
});

test('registerScreen inherits registry.js\'s duplicate-id/override behavior', () => {
  const registry = createRegistry();
  registerScreen(registry, 'inventory', { render: () => {} });

  assert.throws(() => registerScreen(registry, 'inventory', { render: () => {} }));

  const replacement = { render: () => 'v2' };
  registerScreen(registry, 'inventory', replacement, { override: 'inventory' });
  assert.equal(getScreen(registry, 'inventory'), replacement);
});

test('api.openScreen sets a PendingUI marker and locks the engine', () => {
  const api = createApi();
  const player = api.createEntity();

  api.openScreen(player, 'core:dialogue', { text: 'hello' });

  assert.deepEqual(api.getComponent(player, 'PendingUI'), { screenId: 'core:dialogue', payload: { text: 'hello' } });
  assert.equal(api.isLocked(), true);
});

test('api.closeScreen clears PendingUI, dispatches the closing action, spends its cost, and unlocks', () => {
  const api = createApi({ roundBudget: 100 });
  const player = api.createEntity();
  api.addActor(player, 10);

  let applied;
  api.registerRule('resolve-check', 'ResolveSkillCheck', (action) => {
    applied = action;
  });

  api.openScreen(player, 'core:dice-roll', { dc: 12 });
  const result = api.closeScreen(player, { type: 'ResolveSkillCheck', entity: player, cost: 5, success: true });

  assert.equal(api.getComponent(player, 'PendingUI'), undefined);
  assert.equal(api.isLocked(), false);
  assert.deepEqual(result.resolved.map((a) => a.type), ['ResolveSkillCheck']);
  assert.deepEqual(applied, { type: 'ResolveSkillCheck', entity: player, cost: 5, success: true });
});
