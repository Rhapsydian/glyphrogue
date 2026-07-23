// registerEntity / registerEntityType (scripting-api.md): definitions are
// inert data - "what an entity starts with," not behavior. Both funnel
// through the shared registry (scripting-api.md's single id-namespace),
// storing { components } with no .actionType/.trigger field so they stay
// invisible to actions.js's pipelineFor / sound.js's soundsFor filters,
// same posture as screen.js/sound.js's definitions.
//
// registerEntityType is sugar, not a second runtime concept: it decomposes
// into one registerEntity call plus N registerRule calls. "Rules declared
// inline are automatically scoped to this definition's entities" (the doc)
// needs *some* marker to scope against, since a definition's own components
// (Position, Health, ...) aren't unique to one type - instantiateEntity
// tags every entity it creates with an EntityType component for this,
// reusing the same component-tag-as-marker pattern PlayerControlled/
// ExplodesOnDeath already use elsewhere, rather than inventing a second
// tagging mechanism.

import { register, get } from './registry.js';
import { registerRule } from './actions.js';
import { createEntity, addComponent } from './world.js';

export function registerEntity(registry, id, def, options) {
  register(registry, id, { components: def.components ?? {} }, options);
}

export function getEntityDefinition(registry, id) {
  return get(registry, id);
}

export function registerEntityType(registry, id, def, options) {
  registerEntity(registry, id, { components: def.components }, options);

  (def.rules ?? []).forEach(({ action, handler }, index) => {
    registerRule(registry, `${id}::rule::${index}`, action, handler, {
      components: { all: [{ component: 'EntityType', equals: { type: id } }] },
    });
  });
}

// The instantiate step for both registerEntity and registerEntityType -
// registerEntityType's decomposition stores its definition under the same
// id via registerEntity internally, so one function covers both. Each
// component's data is shallow-cloned per instance so instances don't share
// mutable state through the registered definition.
export function instantiateEntity(registry, world, id, overrides = {}) {
  const definition = get(registry, id);
  if (!definition) {
    throw new Error(`no entity definition registered under id "${id}"`);
  }

  const entity = createEntity(world);
  addComponent(world, entity, 'EntityType', { type: id });

  for (const [type, data] of Object.entries(definition.components)) {
    addComponent(world, entity, type, { ...data, ...overrides[type] });
  }

  return entity;
}
