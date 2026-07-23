import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import { loadPlugins } from '../src/plugins.js';
import { get } from '../src/registry.js';
import {
  FLEES_PRIORITY,
  GUARDS_PRIORITY,
  CHASES_PLAYER_PRIORITY,
  WANDERS_PRIORITY,
} from '../src/behaviors.js';
import {
  wandersPlugin,
  chasesPlayerPlugin,
  fleesPlugin,
  guardsPlugin,
} from '../src/behaviorPlugins.js';

const openWalkable = () => true;
const openFov = () => false;

function moveTo(result) {
  const move = result.resolved.find((a) => a.type === 'Move');
  return move?.to;
}

test('wandersPlugin registers wandersRule under id "wanders", driving a real turn via api.act()', () => {
  const api = createApi({ isWalkable: openWalkable });
  loadPlugins(api, [wandersPlugin]);

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 0, y: 0 });
  api.addComponent(goblin, 'Wanders', {});
  api.addActor(goblin, 100);

  const { result } = api.act();

  assert.deepEqual(moveTo(result), { x: 1, y: 0 });
});

test('an entity without a Wanders component is unaffected by a loaded wandersPlugin', () => {
  const api = createApi({ isWalkable: openWalkable });
  loadPlugins(api, [wandersPlugin]);

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 0, y: 0 });
  api.addActor(goblin, 100);

  const { result } = api.act();

  assert.equal(moveTo(result), undefined);
});

test('chasesPlayerPlugin registers chasesPlayerRule under id "chases-player"', () => {
  const api = createApi({ isWalkable: openWalkable, isOpaque: openFov });
  loadPlugins(api, [chasesPlayerPlugin]);

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 0, y: 0 });
  api.addComponent(goblin, 'ChasesPlayer', { radius: 8 });
  api.addActor(goblin, 100);

  const player = api.createEntity();
  api.addComponent(player, 'Position', { x: 3, y: 0 });
  api.addComponent(player, 'PlayerControlled', {});

  const { result } = api.act();

  assert.deepEqual(moveTo(result), { x: 1, y: 0 });
});

test('fleesPlugin registers fleesRule under id "flees"', () => {
  const api = createApi({ isWalkable: openWalkable, isOpaque: openFov });
  loadPlugins(api, [fleesPlugin]);

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 0, y: 0 });
  api.addComponent(goblin, 'Flees', { radius: 8 });
  api.addActor(goblin, 100);

  const player = api.createEntity();
  api.addComponent(player, 'Position', { x: -3, y: 0 });
  api.addComponent(player, 'PlayerControlled', {});

  const { result } = api.act();

  assert.deepEqual(moveTo(result), { x: 1, y: 0 });
});

test('guardsPlugin registers guardsRule under id "guards"', () => {
  const api = createApi({ isWalkable: openWalkable });
  loadPlugins(api, [guardsPlugin]);

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 2, y: 5 });
  api.addComponent(goblin, 'Guards', { post: { x: 5, y: 5 } });
  api.addActor(goblin, 100);

  const { result } = api.act();

  assert.deepEqual(moveTo(result), { x: 3, y: 5 });
});

test('all four behavior plugins register with their documented priority and components filter', () => {
  const api = createApi();
  loadPlugins(api, [wandersPlugin, chasesPlayerPlugin, fleesPlugin, guardsPlugin]);

  const expectations = [
    ['wanders', WANDERS_PRIORITY, 'Wanders'],
    ['chases-player', CHASES_PLAYER_PRIORITY, 'ChasesPlayer'],
    ['flees', FLEES_PRIORITY, 'Flees'],
    ['guards', GUARDS_PRIORITY, 'Guards'],
  ];

  for (const [id, priority, marker] of expectations) {
    const entry = get(api.registry, id);
    assert.equal(entry.actionType, 'TakeTurn');
    assert.equal(entry.priority, priority);
    assert.deepEqual(entry.components, { all: [marker] });
  }
});

test('all four behavior plugins declare a core version dependency', () => {
  for (const plugin of [wandersPlugin, chasesPlayerPlugin, fleesPlugin, guardsPlugin]) {
    assert.equal(plugin.version, '1.0.0');
    assert.ok(plugin.dependencies.core);
  }
});
