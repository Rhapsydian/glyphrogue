import { ensureMemory, updateEntityMemory } from './memory.js';
import { createAudioLoader, loadBuffer, getBuffer } from './audioLoader.js';
import { CORE_API_VERSION } from './plugins.js';

// Service plugins (scripting-api.md: "Plugin kinds: Content vs. Service") -
// single-slot, swappable concerns, merged flat onto the live api via
// registerService rather than id-keyed like Content. Ships from
// @glyphrogue/core itself, not a src/plugins/ folder. An author swapping
// either service declares `id: 'memory'`/`id: 'audioLoader'`,
// `override: '<same id>'` on their own plugin - the existing plugin
// override/dependency machinery, nothing new to build.

export const memoryPlugin = {
  id: 'memory',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  // memory.js's functions already take a ctx shaped exactly like api's own
  // hasComponent/getComponent/addComponent surface, so api can be passed
  // straight through as ctx.
  register: (api) => {
    api.registerService('memory', {
      ensureMemory: (entity) => ensureMemory(api, entity),
      updateEntityMemory: (entity, currentFov, lightMap, options) =>
        updateEntityMemory(api, entity, currentFov, lightMap, options),
    });
  },
};

export const audioLoaderPlugin = {
  id: 'audioLoader',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  // Builds its own loader instance and closes over it - a Service plugin
  // constructs whatever internal state it needs itself before handing the
  // bound methods to registerService.
  register: (api) => {
    const loader = createAudioLoader();
    api.registerService('audioLoader', {
      loadBuffer: (audioCtx, id, arrayBuffer) => loadBuffer(loader, audioCtx, id, arrayBuffer),
      getBuffer: (id) => getBuffer(loader, id),
    });
  },
};
