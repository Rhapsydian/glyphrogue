export function createWorld() {
  return {
    nextId: 1,
    entities: new Set(),
    components: new Map(),
  };
}

export function createEntity(world) {
  const entity = world.nextId++;
  world.entities.add(entity);
  return entity;
}

export function destroyEntity(world, entity) {
  world.entities.delete(entity);
  for (const store of world.components.values()) {
    store.delete(entity);
  }
}

export function addComponent(world, entity, type, data = {}) {
  let store = world.components.get(type);
  if (!store) {
    store = new Map();
    world.components.set(type, store);
  }
  store.set(entity, data);
}

export function removeComponent(world, entity, type) {
  world.components.get(type)?.delete(entity);
}

export function getComponent(world, entity, type) {
  return world.components.get(type)?.get(entity);
}

export function hasComponent(world, entity, type) {
  return world.components.get(type)?.has(entity) ?? false;
}

export function query(world, types) {
  const result = [];
  for (const entity of world.entities) {
    if (types.every((type) => hasComponent(world, entity, type))) {
      result.push(entity);
    }
  }
  return result;
}

export function getComponentsForEntity(world, entity) {
  const result = {};
  for (const [type, store] of world.components) {
    if (store.has(entity)) {
      result[type] = store.get(entity);
    }
  }
  return result;
}
