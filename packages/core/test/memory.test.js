import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createEntity, hasComponent, getComponent, addComponent } from '../src/world.js';
import { MEMORY_COMPONENT, ensureMemory, updateEntityMemory } from '../src/memory.js';

function makeCtx(world) {
  return {
    hasComponent: (entity, type) => hasComponent(world, entity, type),
    getComponent: (entity, type) => getComponent(world, entity, type),
    addComponent: (entity, type, data) => addComponent(world, entity, type, data),
  };
}

test('ensureMemory creates an empty Memory component on first call', () => {
  const world = createWorld();
  const ctx = makeCtx(world);
  const entity = createEntity(world);

  const memory = ensureMemory(ctx, entity);

  assert.deepEqual(memory.remembered, new Set());
  assert.deepEqual(memory.lastKnownLight, new Map());
  assert.ok(hasComponent(world, entity, MEMORY_COMPONENT));
});

test('ensureMemory returns the existing component on a second call without resetting it', () => {
  const world = createWorld();
  const ctx = makeCtx(world);
  const entity = createEntity(world);

  const first = ensureMemory(ctx, entity);
  first.remembered.add('1,1');

  const second = ensureMemory(ctx, entity);

  assert.ok(second.remembered.has('1,1'));
});

test('updateEntityMemory updates remembered via visibility.js and persists it back onto the entity', () => {
  const world = createWorld();
  const ctx = makeCtx(world);
  const entity = createEntity(world);

  updateEntityMemory(ctx, entity, new Set(['0,0']), new Map());
  updateEntityMemory(ctx, entity, new Set(['1,0']), new Map());

  const memory = getComponent(world, entity, MEMORY_COMPONENT);
  assert.deepEqual([...memory.remembered].sort(), ['0,0', '1,0']);
});

test('updateEntityMemory only tracks lastKnownLight when preserveLastKnownLight is true', () => {
  const world = createWorld();
  const ctx = makeCtx(world);
  const entity = createEntity(world);
  const lightMap = new Map([['0,0', { level: 5, color: 'white' }]]);

  updateEntityMemory(ctx, entity, new Set(['0,0']), lightMap, { preserveLastKnownLight: false });
  assert.deepEqual(getComponent(world, entity, MEMORY_COMPONENT).lastKnownLight, new Map());

  updateEntityMemory(ctx, entity, new Set(['0,0']), lightMap, { preserveLastKnownLight: true });
  assert.deepEqual(getComponent(world, entity, MEMORY_COMPONENT).lastKnownLight.get('0,0'), { level: 5, color: 'white' });
});
