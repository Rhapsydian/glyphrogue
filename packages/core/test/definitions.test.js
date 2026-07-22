import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, hasComponent, getComponent } from '../src/world.js';
import { createRegistry } from '../src/registry.js';
import { dispatch } from '../src/actions.js';
import {
  registerEntity,
  registerEntityType,
  getEntityDefinition,
  instantiateEntity,
} from '../src/definitions.js';

test('registerEntity stores an inert component-bag definition', () => {
  const registry = createRegistry();

  registerEntity(registry, 'torch', { components: { Flammable: {} } });

  assert.deepEqual(getEntityDefinition(registry, 'torch'), {
    components: { Flammable: {} },
  });
});

test('instantiateEntity creates an entity with the definition\'s components', () => {
  const world = createWorld();
  const registry = createRegistry();
  registerEntity(registry, 'goblin', {
    components: { Position: { x: 0, y: 0 }, Health: { current: 5, max: 5 } },
  });

  const entity = instantiateEntity(registry, world, 'goblin');

  assert.deepEqual(getComponent(world, entity, 'Position'), { x: 0, y: 0 });
  assert.deepEqual(getComponent(world, entity, 'Health'), { current: 5, max: 5 });
  assert.deepEqual(getComponent(world, entity, 'EntityType'), { type: 'goblin' });
});

test('instantiateEntity clones component data so instances do not share state', () => {
  const world = createWorld();
  const registry = createRegistry();
  registerEntity(registry, 'goblin', { components: { Health: { current: 5, max: 5 } } });

  const a = instantiateEntity(registry, world, 'goblin');
  const b = instantiateEntity(registry, world, 'goblin');

  getComponent(world, a, 'Health').current = 1;

  assert.equal(getComponent(world, b, 'Health').current, 5);
});

test('instantiateEntity applies per-instance overrides on top of the definition', () => {
  const world = createWorld();
  const registry = createRegistry();
  registerEntity(registry, 'goblin', { components: { Health: { current: 5, max: 5 } } });

  const entity = instantiateEntity(registry, world, 'goblin', { Health: { current: 2 } });

  assert.deepEqual(getComponent(world, entity, 'Health'), { current: 2, max: 5 });
});

test('instantiateEntity throws for an unregistered id', () => {
  const world = createWorld();
  const registry = createRegistry();

  assert.throws(() => instantiateEntity(registry, world, 'nonexistent'));
});

test('registerEntityType decomposes into registerEntity plus rules scoped to its own instances', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];

  registerEntityType(registry, 'goblin', {
    components: { Position: { x: 0, y: 0 }, ExplodesOnDeath: {} },
    rules: [
      {
        action: 'Death',
        handler: (action) => {
          seen.push(action.entity);
          return { followOn: [{ type: 'Explosion', entity: action.entity }] };
        },
      },
    ],
  });

  const goblin = instantiateEntity(registry, world, 'goblin');
  const other = instantiateEntity(registry, world, 'goblin');
  // Confirm the definition itself is stored under the same id, same as registerEntity.
  assert.ok(getEntityDefinition(registry, 'goblin').components.Position);
  assert.ok(hasComponent(world, other, 'EntityType'));

  dispatch(world, registry, { type: 'Death', entity: goblin });

  assert.deepEqual(seen, [goblin]);
});

test('registerEntityType rules never fire for entities of a different type', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];

  registerEntityType(registry, 'goblin', {
    components: {},
    rules: [{ action: 'Death', handler: (action) => { seen.push(action.entity); } }],
  });
  registerEntity(registry, 'crate', { components: {} });

  const crate = instantiateEntity(registry, world, 'crate');
  dispatch(world, registry, { type: 'Death', entity: crate });

  assert.deepEqual(seen, []);
});

test('registerEntityType rules never fire for entities with no EntityType at all', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];

  registerEntityType(registry, 'goblin', {
    components: {},
    rules: [{ action: 'Death', handler: (action) => { seen.push(action.entity); } }],
  });

  dispatch(world, registry, { type: 'Death', entity: 999 });

  assert.deepEqual(seen, []);
});
