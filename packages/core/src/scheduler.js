export function createScheduler(roundBudget) {
  return {
    roundBudget,
    actors: new Map(),
  };
}

export function addActor(scheduler, entity, initialBudget = 0) {
  scheduler.actors.set(entity, initialBudget);
}

export function removeActor(scheduler, entity) {
  scheduler.actors.delete(entity);
}

export function next(scheduler) {
  if (scheduler.actors.size === 0) {
    return undefined;
  }

  if (maxBudget(scheduler) <= 0) {
    for (const entity of scheduler.actors.keys()) {
      scheduler.actors.set(entity, scheduler.actors.get(entity) + scheduler.roundBudget);
    }
  }

  let winner;
  let winnerBudget = -Infinity;
  for (const [entity, budget] of scheduler.actors) {
    if (budget > winnerBudget) {
      winner = entity;
      winnerBudget = budget;
    }
  }
  return winner;
}

// Throws rather than silently producing NaN for an entity that was never
// addActor'd - glyphkeep hit this dogfooding the screen-close path
// (api.closeScreen -> resolvePlayerAction -> spend), a different trigger
// than act()'s already-guarded entity===undefined case (see its comment).
export function spend(scheduler, entity, cost) {
  if (!scheduler.actors.has(entity)) {
    throw new Error(`spend: entity ${String(entity)} is not a registered scheduler actor`);
  }
  scheduler.actors.set(entity, scheduler.actors.get(entity) - cost);
}

function maxBudget(scheduler) {
  let max = -Infinity;
  for (const budget of scheduler.actors.values()) {
    if (budget > max) max = budget;
  }
  return max;
}
