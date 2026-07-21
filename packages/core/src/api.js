import { createWorld, createEntity, destroyEntity, addComponent, removeComponent, getComponent, hasComponent, query } from './world.js';
import { createRegistry, register, get, has, getOrderedIds } from './registry.js';
import { registerRule, dispatch } from './actions.js';
import { createScheduler, addActor, removeActor } from './scheduler.js';
import { createEngine, lock, unlock, isLocked, act, resolvePlayerAction, run } from './engine.js';
import { createRng } from './rng.js';
import { registerGenerator, generateZone } from './mapgen.js';
import { loadZone } from './zoneDiff.js';
import { findPath } from './pathfinding.js';
import { computeFov } from './fov.js';
import { createRenderEventQueue, enqueueRenderEvent, createSequencerState, advanceSequencer } from './renderEvents.js';

const noopPlatform = { unlockAchievement() {} };

// The one public inspection/mutation surface every consumer (game runtime,
// first-party content, editor, mods) goes through, per core-architecture.md.
// Closes over one world+registry+scheduler+engine instance the same way
// actions.js's internal createContext(world) already does for rules - just
// promoted to the public, documented surface.
//
// `isWalkable`/`isOpaque` are the same caller-injected map query every
// TakeTurn rule's ctx.findPath/ctx.computeFov close over (actions.js) -
// exposed here too so non-rule consumers (rendering's player FOV, light
// propagation) can call the same shared primitives directly, per
// rendering.md's "one shared primitive, three consumers" decision.
export function createApi({
  roundBudget = 100,
  seed = 1,
  platform = noopPlatform,
  isWalkable,
  isOpaque,
} = {}) {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(roundBudget);
  const mapQuery = { isWalkable, isOpaque };
  const renderEvents = createRenderEventQueue();
  const engine = createEngine(world, registry, scheduler, mapQuery, renderEvents);
  const rng = createRng(seed);

  return {
    world,
    registry,
    scheduler,
    engine,
    platform,
    rng,
    renderEvents,

    enqueueRenderEvent: (event) => enqueueRenderEvent(renderEvents, event),
    createSequencerState,
    advanceSequencer: (state, now, onTrigger) => advanceSequencer(renderEvents, state, now, onTrigger),

    createEntity: () => createEntity(world),
    destroyEntity: (entity) => destroyEntity(world, entity),
    addComponent: (entity, type, data) => addComponent(world, entity, type, data),
    removeComponent: (entity, type) => removeComponent(world, entity, type),
    getComponent: (entity, type) => getComponent(world, entity, type),
    hasComponent: (entity, type) => hasComponent(world, entity, type),
    query: (types) => query(world, types),

    registerRule: (id, actionType, ruleFn, options) => registerRule(registry, id, actionType, ruleFn, options),
    dispatch: (action) => dispatch(world, registry, action, mapQuery),

    findPath: (from, to, opts) => findPath(from, to, { ...opts, isWalkable: mapQuery.isWalkable }),
    computeFov: (origin, radius, opts) => computeFov(origin, radius, { ...opts, isOpaque: mapQuery.isOpaque }),

    registerGenerator: (id, generatorFn, options) => registerGenerator(registry, id, generatorFn, options),
    generateZone: (args) => generateZone(registry, { worldSeed: seed, ...args }),
    loadZone: (args) => loadZone(registry, { worldSeed: seed, ...args }),

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
