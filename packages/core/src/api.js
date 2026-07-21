import { createWorld, createEntity, destroyEntity, addComponent, removeComponent, getComponent, hasComponent, query } from './world.js';
import { createRegistry, register, get, has, getOrderedIds } from './registry.js';
import { registerRule, dispatch } from './actions.js';
import { createScheduler, addActor, removeActor } from './scheduler.js';
import { createEngine, lock, unlock, isLocked, act, resolvePlayerAction, run } from './engine.js';
import { createRng } from './rng.js';

const noopPlatform = { unlockAchievement() {} };

// The one public inspection/mutation surface every consumer (game runtime,
// first-party content, editor, mods) goes through, per core-architecture.md.
// Closes over one world+registry+scheduler+engine instance the same way
// actions.js's internal createContext(world) already does for rules - just
// promoted to the public, documented surface.
export function createApi({ roundBudget = 100, seed = 1, platform = noopPlatform } = {}) {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(roundBudget);
  const engine = createEngine(world, registry, scheduler);
  const rng = createRng(seed);

  return {
    world,
    registry,
    scheduler,
    engine,
    platform,
    rng,

    createEntity: () => createEntity(world),
    destroyEntity: (entity) => destroyEntity(world, entity),
    addComponent: (entity, type, data) => addComponent(world, entity, type, data),
    removeComponent: (entity, type) => removeComponent(world, entity, type),
    getComponent: (entity, type) => getComponent(world, entity, type),
    hasComponent: (entity, type) => hasComponent(world, entity, type),
    query: (types) => query(world, types),

    registerRule: (id, actionType, ruleFn, options) => registerRule(registry, id, actionType, ruleFn, options),
    dispatch: (action) => dispatch(world, registry, action),

    addActor: (entity, initialBudget) => addActor(scheduler, entity, initialBudget),
    removeActor: (entity) => removeActor(scheduler, entity),

    act: () => act(engine),
    resolvePlayerAction: (entity, action) => resolvePlayerAction(engine, entity, action),
    run: () => run(engine),
    lock: () => lock(engine),
    unlock: () => unlock(engine),
    isLocked: () => isLocked(engine),
  };
}
