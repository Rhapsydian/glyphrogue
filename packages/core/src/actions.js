import { register, get, getOrderedIds } from './registry.js';
import {
  hasComponent,
  getComponent,
  addComponent,
  removeComponent,
  createEntity,
  destroyEntity,
  query,
} from './world.js';

export function registerRule(registry, id, actionType, ruleFn, options = {}) {
  const { priority = 0, ...registryOptions } = options;
  register(registry, id, { actionType, ruleFn, priority }, registryOptions);
}

function pipelineFor(registry, actionType) {
  return getOrderedIds(registry)
    .map((id) => get(registry, id))
    .filter((entry) => entry.actionType === actionType);
}

function resolvePriority(entry, action, ctx) {
  return typeof entry.priority === 'function' ? entry.priority(action, ctx) : entry.priority;
}

function createContext(world) {
  return {
    hasComponent: (entity, type) => hasComponent(world, entity, type),
    getComponent: (entity, type) => getComponent(world, entity, type),
    addComponent: (entity, type, data) => addComponent(world, entity, type, data),
    removeComponent: (entity, type) => removeComponent(world, entity, type),
    createEntity: () => createEntity(world),
    destroyEntity: (entity) => destroyEntity(world, entity),
    query: (types) => query(world, types),
  };
}

export function dispatch(world, registry, action) {
  const resolved = [];
  const vetoed = [];
  const queue = [action];
  const ctx = createContext(world);

  while (queue.length > 0) {
    const current = queue.shift();
    const pipeline = pipelineFor(registry, current.type);

    let isVetoed = false;
    const followOns = [];

    for (const { ruleFn } of pipeline) {
      const result = ruleFn(current, ctx);
      if (!result) continue;
      if (result.veto) {
        isVetoed = true;
        break;
      }
      if (result.followOn) {
        followOns.push(...result.followOn);
      }
    }

    if (isVetoed) {
      vetoed.push(current);
      continue;
    }

    resolved.push(current);
    queue.push(...followOns);
  }

  return { resolved, vetoed };
}

// Exclusive resolution: unlike dispatch(), where every matching rule's
// effect applies, only the single highest-priority applicable rule's
// result is used - the rest are discarded candidates, never applied.
// Ties keep the earlier-registered (load-order) rule. This is for action
// types representing a mutually-exclusive choice (TakeTurn: an actor
// can't both Flee and Guard the same turn), not the additive-reaction
// shape most action types use.
export function dispatchExclusive(world, registry, action) {
  const ctx = createContext(world);
  const pipeline = pipelineFor(registry, action.type);

  let winnerResult;
  let winnerPriority = -Infinity;

  for (const entry of pipeline) {
    const result = entry.ruleFn(action, ctx);
    if (!result) continue;

    const priority = resolvePriority(entry, action, ctx);
    if (priority > winnerPriority) {
      winnerPriority = priority;
      winnerResult = result;
    }
  }

  const resolved = [action];
  const vetoed = [];

  for (const followOnAction of winnerResult?.followOn ?? []) {
    const sub = dispatch(world, registry, followOnAction);
    resolved.push(...sub.resolved);
    vetoed.push(...sub.vetoed);
  }

  return { resolved, vetoed };
}
