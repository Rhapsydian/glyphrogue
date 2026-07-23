import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  createEntity,
  destroyEntity,
  addComponent,
  removeComponent,
  getComponent,
  hasComponent,
  query,
  getComponentsForEntity,
} from '../src/world.js';

test('create/query/destroy round trip', () => {
  const world = createWorld();
  const entity = createEntity(world);
  addComponent(world, entity, 'Position', { x: 1, y: 2 });

  assert.equal(hasComponent(world, entity, 'Position'), true);
  assert.deepEqual(getComponent(world, entity, 'Position'), { x: 1, y: 2 });
  assert.deepEqual(query(world, ['Position']), [entity]);

  destroyEntity(world, entity);
  assert.equal(world.entities.has(entity), false);
  assert.deepEqual(query(world, ['Position']), []);
});

test('query with multiple component types returns the intersection', () => {
  const world = createWorld();
  const both = createEntity(world);
  const positionOnly = createEntity(world);

  addComponent(world, both, 'Position', { x: 0, y: 0 });
  addComponent(world, both, 'Health', { current: 10, max: 10 });
  addComponent(world, positionOnly, 'Position', { x: 5, y: 5 });

  assert.deepEqual(query(world, ['Position', 'Health']), [both]);
  assert.deepEqual(query(world, ['Position']).sort(), [both, positionOnly].sort());
});

test('removing a component drops the entity from a query that needs it', () => {
  const world = createWorld();
  const entity = createEntity(world);
  addComponent(world, entity, 'Position', { x: 0, y: 0 });
  addComponent(world, entity, 'Health', { current: 10, max: 10 });

  assert.deepEqual(query(world, ['Position', 'Health']), [entity]);

  removeComponent(world, entity, 'Health');
  assert.deepEqual(query(world, ['Position', 'Health']), []);
  assert.equal(hasComponent(world, entity, 'Position'), true);
});

test('destroying an entity removes it from every component store', () => {
  const world = createWorld();
  const entity = createEntity(world);
  addComponent(world, entity, 'Position', { x: 0, y: 0 });
  addComponent(world, entity, 'Health', { current: 10, max: 10 });

  destroyEntity(world, entity);

  assert.equal(hasComponent(world, entity, 'Position'), false);
  assert.equal(hasComponent(world, entity, 'Health'), false);
  assert.equal(getComponent(world, entity, 'Position'), undefined);
});

test('getComponentsForEntity returns every component the entity has, keyed by type', () => {
  const world = createWorld();
  const entity = createEntity(world);
  addComponent(world, entity, 'Position', { x: 1, y: 2 });
  addComponent(world, entity, 'Health', { current: 5, max: 10 });
  addComponent(world, entity, 'Flammable', {});

  assert.deepEqual(getComponentsForEntity(world, entity), {
    Position: { x: 1, y: 2 },
    Health: { current: 5, max: 10 },
    Flammable: {},
  });
});

test('getComponentsForEntity returns an empty object for an entity with no components', () => {
  const world = createWorld();
  const entity = createEntity(world);

  assert.deepEqual(getComponentsForEntity(world, entity), {});
});

test('getComponentsForEntity only includes types the entity actually has, not every registered type', () => {
  const world = createWorld();
  const withPosition = createEntity(world);
  const withHealth = createEntity(world);
  addComponent(world, withPosition, 'Position', { x: 0, y: 0 });
  addComponent(world, withHealth, 'Health', { current: 1, max: 1 });

  assert.deepEqual(getComponentsForEntity(world, withPosition), { Position: { x: 0, y: 0 } });
});
