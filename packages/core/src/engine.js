import { hasComponent, getComponent, destroyEntity } from './world.js';
import { dispatch, dispatchExclusive } from './actions.js';
import { next, spend, removeActor } from './scheduler.js';

export function createEngine(world, registry, scheduler, mapQuery, renderEvents) {
  return { world, registry, scheduler, mapQuery, renderEvents, locked: false };
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
    const result = dispatch(engine.world, engine.registry, action, engine.mapQuery, engine.renderEvents, engine.scheduler);
    removeActor(engine.scheduler, entity);
    destroyEntity(engine.world, entity);
    return { entity, waiting: false, result };
  }

  const result = dispatchExclusive(engine.world, engine.registry, { type: 'TakeTurn', entity }, engine.mapQuery, engine.renderEvents, engine.scheduler);
  spend(engine.scheduler, entity, sumCost(result.resolved));
  return { entity, waiting: false, result };
}

export function resolvePlayerAction(engine, entity, action) {
  const result = dispatch(engine.world, engine.registry, action, engine.mapQuery, engine.renderEvents, engine.scheduler);
  spend(engine.scheduler, entity, sumCost(result.resolved));
  unlock(engine);
  return result;
}

export function run(engine) {
  const turns = [];
  while (!engine.locked) {
    turns.push(act(engine));
  }
  return turns;
}
