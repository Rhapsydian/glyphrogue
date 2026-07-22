// registerScreen (custom-ui-and-interactions.md): the generic core->UI
// hand-off mechanism, replacing the one-off PendingUI-per-screen-type idea
// with a single id-first registration, same shape as registerRule/
// registerGenerator. Shares the one registry instance every other
// register* call uses (scripting-api.md's single id-namespace) - safe
// because actions.js's pipelineFor/soundsFor filter by .actionType/.trigger,
// and a screen definition never sets either field.

import { register, get } from './registry.js';

export function registerScreen(registry, id, definition, options) {
  register(registry, id, definition, options);
}

export function getScreen(registry, id) {
  return get(registry, id);
}
