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
  register(registry, id, { actionType, ruleFn }, options);
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
    const pipeline = getOrderedIds(registry)
      .map((id) => get(registry, id))
      .filter((entry) => entry.actionType === current.type);

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
