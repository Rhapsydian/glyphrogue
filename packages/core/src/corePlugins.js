import { bspPlugin, cellularAutomataPlugin, wfcPlugin, layeredBiomePlugin } from './generatorPlugins.js';
import { wandersPlugin, chasesPlayerPlugin, fleesPlugin, guardsPlugin } from './behaviorPlugins.js';
import { memoryPlugin, audioLoaderPlugin } from './servicePlugins.js';

// One aggregate list of every plugin this package ships, so a consumer
// (packages/editor's plugin-management discovery, editor.md) doesn't have
// to hand-maintain a second copy of these ten names - same "derive, don't
// hand-maintain" posture the mod manifest/components filter/touched-files
// log already use elsewhere in this project.
export const CORE_PLUGINS = [
  bspPlugin,
  cellularAutomataPlugin,
  wfcPlugin,
  layeredBiomePlugin,
  wandersPlugin,
  chasesPlayerPlugin,
  fleesPlugin,
  guardsPlugin,
  memoryPlugin,
  audioLoaderPlugin,
];
