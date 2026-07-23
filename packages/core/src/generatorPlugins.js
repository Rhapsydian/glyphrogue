import { bspGenerator, DEFAULT_MIN_PARTITION_SIZE, DEFAULT_ROOM_MARGIN } from './bsp.js';
import { cellularAutomataGenerator } from './cellularAutomataGenerator.js';
import { wfcGenerator, DEFAULT_MAX_RETRIES } from './waveFunctionCollapse.js';
import { layeredBiomeGenerator } from './layeredBiome.js';
import { CORE_API_VERSION } from './plugins.js';

// Content plugins (scripting-api.md: first-party map generators use the
// same Plugin module format as any end-user plugin) wrapping each of the
// four built-in generators. Ships from @glyphrogue/core itself, not a
// src/plugins/ folder - that convention is for author-created plugins in
// a downstream game's own repo. Not auto-wired onto createApi() - a
// generator id is content, not infrastructure, same precedent every
// generator module's own header comment already states; a game's own
// bootstrap calls loadPlugins with whichever of these it wants.

export const bspPlugin = {
  id: 'bsp',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  register: (api) => {
    api.registerGenerator('bsp', bspGenerator, {
      paramsDefaults: { minPartitionSize: DEFAULT_MIN_PARTITION_SIZE, roomMargin: DEFAULT_ROOM_MARGIN },
    });
  },
};

export const cellularAutomataPlugin = {
  id: 'cellular-automata',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  // No paramsDefaults - fillProbability/passes/wallThreshold's defaults
  // live buried in carveCellularAutomata (zoneComposition.js), not
  // extracted to a constant the way bsp/wfc's were in session 28.
  register: (api) => {
    api.registerGenerator('cellular-automata', cellularAutomataGenerator);
  },
};

export const wfcPlugin = {
  id: 'wfc',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  register: (api) => {
    api.registerGenerator('wfc', wfcGenerator, {
      paramsDefaults: { maxRetries: DEFAULT_MAX_RETRIES },
    });
  },
};

export const layeredBiomePlugin = {
  id: 'layered-biome',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  // No seedCount in paramsDefaults - partitionBiomes's default
  // (biomes.length * 2) is computed from another param, not a constant,
  // the documented exception to the other three generators' migration.
  register: (api) => {
    api.registerGenerator('layered-biome', layeredBiomeGenerator);
  },
};
