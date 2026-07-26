import { hasComponent, getComponent, destroyEntity } from './world.js';
import { dispatch, dispatchExclusive } from './actions.js';
import { next, spend, removeActor } from './scheduler.js';

export function createEngine(world, registry, scheduler, mapQuery, renderEvents, devMode = false) {
  return { world, registry, scheduler, mapQuery, renderEvents, devMode, locked: false };
}

export function lock(engine) {
  engine.locked = true;
}

export function unlock(engine) {
  engine.locked = false;
}

export function isLocked(engine) {
  return engine.locked;
}

function sumCost(actions) {
  return actions.reduce((total, action) => total + (action.cost ?? 0), 0);
}

export function act(engine) {
  const entity = next(engine.scheduler);

  // next() returns undefined when the scheduler has no registered actors at
  // all (scheduler.js) - previously fell straight through to
  // dispatchExclusive/spend with entity=undefined, which corrupts
  // scheduler.actors with an undefined -> NaN entry (spend() has no
  // existing-actor guard either) that then makes every future next() call
  // return undefined too, forever, without ever locking - run()'s while
  // loop had no other exit condition, so this hung the calling thread
  // (the browser's main thread, in practice) rather than erroring. Found
  // dogfooding this in glyphkeep (a scaffolded game that hadn't yet added
  // its player as an actor when it first called run()).
  if (entity === undefined) {
    return { entity: undefined, waiting: false, idle: true };
  }

  if (hasComponent(engine.world, entity, 'PlayerControlled')) {
    lock(engine);
    return { entity, waiting: true };
  }

  // A Timer entity (scripting-api.md's timeUnits waitFor, scheduled via a
  // negative initial budget - see scriptedEvents.js) isn't a real actor: it
  // dispatches its carried action once, then removes itself, rather than
  // going through dispatchExclusive's TakeTurn/behaviors pipeline.
  if (hasComponent(engine.world, entity, 'Timer')) {
    const { action } = getComponent(engine.world, entity, 'Timer');
    const result = dispatch(engine.world, engine.registry, action, engine.mapQuery, engine.renderEvents, engine.scheduler, engine.devMode);
    removeActor(engine.scheduler, entity);
    destroyEntity(engine.world, entity);
    return { entity, waiting: false, result };
  }

  const result = dispatchExclusive(engine.world, engine.registry, { type: 'TakeTurn', entity }, engine.mapQuery, engine.renderEvents, engine.scheduler, engine.devMode);
  spend(engine.scheduler, entity, sumCost(result.resolved));
  return { entity, waiting: false, result };
}

export function resolvePlayerAction(engine, entity, action) {
  const result = dispatch(engine.world, engine.registry, action, engine.mapQuery, engine.renderEvents, engine.scheduler, engine.devMode);
  spend(engine.scheduler, entity, sumCost(result.resolved));
  unlock(engine);
  return result;
}

export function run(engine) {
  const turns = [];
  while (!engine.locked) {
    const turn = act(engine);
    turns.push(turn);
    // No actors registered at all - act() will never lock (only a
    // PlayerControlled actor's turn does that), so without this the loop
    // above would otherwise spin forever on the same idle turn.
    if (turn.idle) break;
  }
  return turns;
}
