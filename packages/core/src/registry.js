export function createRegistry() {
  return {
    entries: new Map(),
    dependsOn: new Map(),
    order: null,
  };
}

export function register(registry, id, value, options = {}) {
  const { override, dependsOn = [] } = options;

  if (override !== undefined && override !== id) {
    throw new Error(`options.override "${override}" does not match id "${id}"`);
  }

  const exists = registry.entries.has(id);

  if (override === id) {
    if (!exists) {
      throw new Error(`cannot override "${id}": nothing is registered under that id`);
    }
  } else if (exists) {
    throw new Error(`id "${id}" is already registered (pass options.override: "${id}" to replace it)`);
  }

  registry.entries.set(id, value);
  registry.dependsOn.set(id, dependsOn);
  registry.order = null;
}

export function get(registry, id) {
  return registry.entries.get(id);
}

export function has(registry, id) {
  return registry.entries.has(id);
}

// Dependency/cycle validation is deliberately deferred to here (not to
// register()), so registrations can happen in any order — a rule can
// declare dependsOn an id that hasn't been registered yet, as long as it
// exists by the time the order is actually needed. This is what makes
// dependsOn useful at all: real mod/content loading order isn't
// guaranteed to match dependency order, that's the whole reason a
// topological sort is needed instead of trusting registration order.
export function getOrderedIds(registry) {
  if (registry.order === null) {
    registry.order = topologicalOrder(registry);
  }
  return [...registry.order];
}

function topologicalOrder(registry) {
  const ids = [...registry.entries.keys()];
  const visited = new Set();
  const visiting = new Set();
  const order = [];

  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`dependency cycle detected involving "${id}"`);
    }

    visiting.add(id);
    for (const dep of registry.dependsOn.get(id) ?? []) {
      if (!registry.entries.has(dep)) {
        throw new Error(`"${id}" depends on "${dep}", which is not registered`);
      }
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }

  for (const id of ids) {
    visit(id);
  }

  return order;
}
