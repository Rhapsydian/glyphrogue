import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createEntity, addComponent, getComponent } from '../src/world.js';
import { createRegistry } from '../src/registry.js';
import { registerRule, dispatchExclusive } from '../src/actions.js';
import {
  wandersRule,
  chasesPlayerRule,
  fleesRule,
  guardsRule,
  FLEES_PRIORITY,
  GUARDS_PRIORITY,
  CHASES_PLAYER_PRIORITY,
  WANDERS_PRIORITY,
} from '../src/behaviors.js';

const openWalkable = () => true;

function takeTurn(world, registry, entity, mapQuery) {
  return dispatchExclusive(world, registry, { type: 'TakeTurn', entity }, mapQuery);
}

function moveTo(result) {
  const move = result.resolved.find((a) => a.type === 'Move');
  return move?.to;
}

test('an entity without a Wanders component never invokes wandersRule (registerRule\'s components filter)', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  registerRule(registry, 'wanders', 'TakeTurn', wandersRule, { components: { all: ['Wanders'] } });

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable });

  assert.equal(moveTo(result), undefined);
});

test('wandersRule moves in the first walkable direction (east by default)', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'Wanders', {});
  registerRule(registry, 'wanders', 'TakeTurn', wandersRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable });

  assert.deepEqual(moveTo(result), { x: 1, y: 0 });
});

test('wandersRule skips a blocked direction and cycles its stored direction forward', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'Wanders', {});
  registerRule(registry, 'wanders', 'TakeTurn', wandersRule);

  // East (1,0) is walled off; south (0,1) is the next direction in order.
  const isWalkable = (x, y) => !(x === 1 && y === 0);

  const result = takeTurn(world, registry, goblin, { isWalkable });

  assert.deepEqual(moveTo(result), { x: 0, y: 1 });
  assert.equal(getComponent(world, goblin, 'Wanders').lastDirection, 2);
});

test('wandersRule no-ops when every direction is blocked', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'Wanders', {});
  registerRule(registry, 'wanders', 'TakeTurn', wandersRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: () => false });

  assert.equal(moveTo(result), undefined);
});

test('an entity without a ChasesPlayer component never invokes chasesPlayerRule (registerRule\'s components filter)', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  const player = createEntity(world);
  addComponent(world, player, 'Position', { x: 2, y: 0 });
  addComponent(world, player, 'PlayerControlled', {});
  registerRule(registry, 'chase', 'TakeTurn', chasesPlayerRule, { components: { all: ['ChasesPlayer'] } });

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable, isOpaque: () => false });

  assert.equal(moveTo(result), undefined);
});

test('chasesPlayerRule no-ops when the player is out of FOV range', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'ChasesPlayer', { radius: 2 });
  const player = createEntity(world);
  addComponent(world, player, 'Position', { x: 10, y: 0 });
  addComponent(world, player, 'PlayerControlled', {});
  registerRule(registry, 'chase', 'TakeTurn', chasesPlayerRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable, isOpaque: () => false });

  assert.equal(moveTo(result), undefined);
});

test('chasesPlayerRule paths toward a visible player', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'ChasesPlayer', { radius: 8 });
  const player = createEntity(world);
  addComponent(world, player, 'Position', { x: 3, y: 0 });
  addComponent(world, player, 'PlayerControlled', {});
  registerRule(registry, 'chase', 'TakeTurn', chasesPlayerRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable, isOpaque: () => false });

  assert.deepEqual(moveTo(result), { x: 1, y: 0 });
});

test('fleesRule no-ops when the player is not visible', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'Flees', { radius: 2 });
  const player = createEntity(world);
  addComponent(world, player, 'Position', { x: 10, y: 0 });
  addComponent(world, player, 'PlayerControlled', {});
  registerRule(registry, 'flees', 'TakeTurn', fleesRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable, isOpaque: () => false });

  assert.equal(moveTo(result), undefined);
});

test('fleesRule steps toward the neighbor that maximizes distance from a visible player', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'Flees', { radius: 8 });
  const player = createEntity(world);
  addComponent(world, player, 'Position', { x: -3, y: 0 });
  addComponent(world, player, 'PlayerControlled', {});
  registerRule(registry, 'flees', 'TakeTurn', fleesRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable, isOpaque: () => false });

  // player is to the west; fleeing east maximizes distance among the
  // four orthogonal neighbors.
  assert.deepEqual(moveTo(result), { x: 1, y: 0 });
});

test('an entity without a Guards component never invokes guardsRule (registerRule\'s components filter)', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 5, y: 5 });
  registerRule(registry, 'guards', 'TakeTurn', guardsRule, { components: { all: ['Guards'] } });

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable });

  assert.equal(moveTo(result), undefined);
});

test('guardsRule no-ops when already at its post', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 5, y: 5 });
  addComponent(world, goblin, 'Guards', { post: { x: 5, y: 5 } });
  registerRule(registry, 'guards', 'TakeTurn', guardsRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable });

  assert.equal(moveTo(result), undefined);
});

test('guardsRule paths back toward its post when away from it', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 2, y: 5 });
  addComponent(world, goblin, 'Guards', { post: { x: 5, y: 5 } });
  registerRule(registry, 'guards', 'TakeTurn', guardsRule);

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable });

  assert.deepEqual(moveTo(result), { x: 3, y: 5 });
});

test('default priorities resolve Flees over Guards over ChasesPlayer over Wanders', () => {
  const world = createWorld();
  const registry = createRegistry();
  const goblin = createEntity(world);
  addComponent(world, goblin, 'Position', { x: 0, y: 0 });
  addComponent(world, goblin, 'Wanders', {});
  addComponent(world, goblin, 'ChasesPlayer', { radius: 8 });
  addComponent(world, goblin, 'Guards', { post: { x: 5, y: 5 } });
  addComponent(world, goblin, 'Flees', { radius: 8 });

  const player = createEntity(world);
  addComponent(world, player, 'Position', { x: 3, y: 0 });
  addComponent(world, player, 'PlayerControlled', {});

  registerRule(registry, 'wanders', 'TakeTurn', wandersRule, { priority: WANDERS_PRIORITY });
  registerRule(registry, 'chase', 'TakeTurn', chasesPlayerRule, { priority: CHASES_PLAYER_PRIORITY });
  registerRule(registry, 'guards', 'TakeTurn', guardsRule, { priority: GUARDS_PRIORITY });
  registerRule(registry, 'flees', 'TakeTurn', fleesRule, { priority: FLEES_PRIORITY });

  const result = takeTurn(world, registry, goblin, { isWalkable: openWalkable, isOpaque: () => false });

  // Flees wins over Guards/ChasesPlayer/Wanders. The player sits due east
  // (3,0), so south/west/north all tie for "away" (fleesRule's documented
  // tie-break) and south, listed first among them in DIRECTIONS, wins.
  assert.deepEqual(moveTo(result), { x: 0, y: 1 });
});
