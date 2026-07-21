import { hasComponent } from './world.js';
import { dispatch, dispatchExclusive } from './actions.js';
import { next, spend } from './scheduler.js';

export function createEngine(world, registry, scheduler) {
  return { world, registry, scheduler, locked: false };
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

  const result = dispatchExclusive(engine.world, engine.registry, { type: 'TakeTurn', entity });
  spend(engine.scheduler, entity, sumCost(result.resolved));
  return { entity, waiting: false, result };
}

export function resolvePlayerAction(engine, entity, action) {
  const result = dispatch(engine.world, engine.registry, action);
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
