// registerSound (audio.md): reactive core->audio hand-off - a sound fires
// off which action type just resolved, no PendingSound marker. Shares the
// one registry instance every other register* call uses; stores
// { trigger, source, match } with no .actionType field, so it stays
// invisible to actions.js's rule-pipeline filtering (pipelineFor).

import { register, get, getOrderedIds } from './registry.js';

export function registerSound(registry, id, definition, options) {
  register(registry, id, definition, options);
}

export function getSound(registry, id) {
  return get(registry, id);
}

export function soundsFor(registry, actionType) {
  return getOrderedIds(registry)
    .map((id) => ({ id, entry: get(registry, id) }))
    .filter(({ entry }) => entry.trigger === actionType);
}
