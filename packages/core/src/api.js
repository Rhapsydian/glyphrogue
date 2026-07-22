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
import { registerScreen, getScreen } from './screen.js';
import { registerSound } from './sound.js';
import { registerEntity, registerEntityType, getEntityDefinition, instantiateEntity } from './definitions.js';
import { registerScriptedEvent, getScriptedEvent } from './scriptedEvents.js';

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
    // Threads renderEvents/scheduler through the same as act()/
    // resolvePlayerAction - previously omitted here, which meant a rule
    // dispatched directly via api.dispatch (e.g. a scripted event's
    // trigger) couldn't reach ctx.enqueueRenderEvent/addActor. Surfaced by
    // registerScriptedEvent's timeUnits wait needing ctx.addActor to work
    // from an ordinary api.dispatch() call, not just from inside act().
    dispatch: (action) => dispatch(world, registry, action, mapQuery, renderEvents, scheduler),

    findPath: (from, to, opts) => findPath(from, to, { ...opts, isWalkable: mapQuery.isWalkable }),
    computeFov: (origin, radius, opts) => computeFov(origin, radius, { ...opts, isOpaque: mapQuery.isOpaque }),

    registerGenerator: (id, generatorFn, options) => registerGenerator(registry, id, generatorFn, options),
    generateZone: (args) => generateZone(registry, { worldSeed: seed, ...args }),
    loadZone: (args) => loadZone(registry, { worldSeed: seed, ...args }),

    addActor: (entity, initialBudget) => addActor(scheduler, entity, initialBudget),
    removeActor: (entity) => removeActor(scheduler, entity),

    registerSound: (id, definition, options) => registerSound(registry, id, definition, options),

    registerEntity: (id, def, options) => registerEntity(registry, id, def, options),
    registerEntityType: (id, def, options) => registerEntityType(registry, id, def, options),
    getEntityDefinition: (id) => getEntityDefinition(registry, id),
    instantiateEntity: (id, overrides) => instantiateEntity(registry, world, id, overrides),

    registerScriptedEvent: (id, def, options) => registerScriptedEvent(registry, id, def, options),
    getScriptedEvent: (id) => getScriptedEvent(registry, id),
    registerScreen: (id, definition, options) => registerScreen(registry, id, definition, options),
    getScreen: (id) => getScreen(registry, id),
    // custom-ui-and-interactions.md: opening a screen is simply holding
    // lock() open for its lifetime; PendingUI is the core-triggered hand-off
    // marker (UI-initiated screens - e.g. a player-pressed inventory key -
    // skip this entirely and manage lock()/unlock() themselves).
    openScreen: (entity, screenId, payload) => {
      addComponent(world, entity, 'PendingUI', { screenId, payload });
      lock(engine);
    },
    // Closing dispatches exactly one ordinary Action through the normal
    // pipeline - no different in kind from the engine picking back up after
    // any other locked turn, so this delegates to resolvePlayerAction
    // rather than reimplementing dispatch+spend+unlock.
    closeScreen: (entity, action) => {
      removeComponent(world, entity, 'PendingUI');
      return resolvePlayerAction(engine, entity, action);
    },

    act: () => act(engine),
    resolvePlayerAction: (entity, action) => resolvePlayerAction(engine, entity, action),
    run: () => run(engine),
    lock: () => lock(engine),
    unlock: () => unlock(engine),
    isLocked: () => isLocked(engine),
  };
}
