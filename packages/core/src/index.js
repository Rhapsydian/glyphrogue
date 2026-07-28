export {
  createWorld,
  createEntity,
  destroyEntity,
  addComponent,
  removeComponent,
  getComponent,
  hasComponent,
  query,
} from './world.js';

export {
  createRegistry,
  register,
  get,
  has,
  getOrderedIds,
} from './registry.js';

export { registerRule, dispatch, dispatchExclusive } from './actions.js';

export { createScheduler, addActor, removeActor, next, spend } from './scheduler.js';

export {
  createEngine,
  lock,
  unlock,
  isLocked,
  act,
  resolvePlayerAction,
  run,
} from './engine.js';

export { createRng } from './rng.js';

// The public API surface every consumer should prefer - see api.js.
export { createApi } from './api.js';

export { serialize, deserialize, runMigrations, CORE_SCHEMA_VERSION } from './save.js';

export { createMemoryStorage, createLocalStorageBackend, createFsStorage, writeFileAtomic } from './storage.js';

export {
  createGlyphMetrics,
  cellSize,
  glyphAdvance,
  baselineOffset,
  fontSizePx,
} from './glyphMetrics.js';

export {
  createCamera,
  updateCamera,
  worldToScreen,
  screenToWorld,
  screenToCanvasPixel,
  worldToCanvasPixel,
  isInViewport,
} from './camera.js';

// rendering.md: "one shared shadowcasting primitive, three consumers"
// (player FOV, per-monster perception, light-source propagation) - meant
// for direct downstream use beyond api.computeFov's player-FOV-bound
// wrapper (e.g. a light-propagation pass against a different isOpaque).
export { computeFov, fovContains } from './fov.js';

export {
  createRenderEventQueue,
  enqueueRenderEvent,
  createSequencerState,
  advanceSequencer,
} from './renderEvents.js';

export {
  MEMORY_TONE,
  classifyVisibility,
  updateRemembered,
  computeLighting,
  cellRenderState,
  updateLastKnownLight,
} from './visibility.js';

export { MEMORY_COMPONENT, ensureMemory, updateEntityMemory } from './memory.js';

export {
  createAnimationState,
  startTween,
  advanceAnimation,
  tweenedPosition,
  addTransientEffect,
  activeEffects,
} from './animation.js';

export { setLayerFont, drawGlyphCell, drawCellBackground, drawTileCell } from './glyphRenderer.js';

export { createPalette, resolveColor } from './palette.js';

export {
  createFontSourceRegistry,
  registerFontSource,
  getFontSource,
  setReferenceFontSource,
  deriveCalibration,
  calibratedGlyphAdvance,
  calibratedBaselineOffset,
} from './fontSources.js';

export { createTileset, registerSymbol, resolveSymbol } from './tileset.js';

export { glyphManifestToFontSource } from './pixelyphImport.js';

export {
  createLayerState,
  terrainLayerDirty,
  markTerrainClean,
  terrainDrawCommands,
  entityDrawCommands,
  paintLayer,
} from './renderLayers.js';

export { registerScreen, getScreen } from './screen.js';

export { registerSound, getSound } from './sound.js';

export {
  registerEntity,
  registerEntityType,
  getEntityDefinition,
  instantiateEntity,
} from './definitions.js';

export { registerScriptedEvent, getScriptedEvent } from './scriptedEvents.js';

export { loadPlugins, satisfiesRange, CORE_API_VERSION } from './plugins.js';

export {
  bspPlugin,
  cellularAutomataPlugin,
  wfcPlugin,
  layeredBiomePlugin,
} from './generatorPlugins.js';

export {
  wandersPlugin,
  chasesPlayerPlugin,
  fleesPlugin,
  guardsPlugin,
} from './behaviorPlugins.js';

// Raw rule function, not just the pre-wrapped fleesPlugin (which bakes in a
// fixed `components: { all: ['Flees'] }` filter) - a downstream game
// authoring its own tighter registerRule filter around the same tested
// movement logic (e.g. a health-gated "flees only once hurt" combo) has no
// way to reach it without reimplementing fleeing locally otherwise. Found
// by glyphkeep's Phase 2 slime archetype.
//
// The priority constants travel with it - a custom rule composing with the
// four first-party behaviors needs to place itself in the *real* priority
// ordering (self-preservation beats duty beats aggression beats idling),
// not a hardcoded magic number that silently drifts if this ordering is
// ever retuned.
// DEFAULT_MOVE_COST travels too - found live: glyphkeep independently
// redeclared the same "100" twice (its own MOVE_COST for the player's Move
// action, then again for a fallback-turn Pass cost), purely because there
// was no way to reference the real engine constant both are meant to stay
// in lockstep with for "uniform one action per turn" to actually hold.
export {
  fleesRule,
  FLEES_PRIORITY,
  GUARDS_PRIORITY,
  CHASES_PLAYER_PRIORITY,
  WANDERS_PRIORITY,
  DEFAULT_MOVE_COST,
} from './behaviors.js';

export { memoryPlugin, audioLoaderPlugin } from './servicePlugins.js';

export { CORE_PLUGINS } from './corePlugins.js';

export { createRecordingApi } from './recordingApi.js';

export { playSound, playMusic } from './audio.js';

export { createAudioLoader, loadBuffer, getBuffer } from './audioLoader.js';

export { saveMixSettings, loadMixSettings } from './audioSettings.js';

// Region-scoped composition primitives, for authoring tools (e.g. the
// generator composition tool - docs/design/editor.md) that call several
// of these directly against different regions of the same zone.
// createZone/nearestOpenCell round out the surface those tools need to
// build a zone from scratch and derive an entry point for the one
// primitive (carveCellularAutomata) that doesn't return one itself.
export { carveBsp } from './bsp.js';
export { carveCellularAutomata, connectCorridor, createZone, nearestOpenCell, isWalkableCell } from './zoneComposition.js';
export { collapseWfc } from './waveFunctionCollapse.js';
export { partitionBiomes } from './layeredBiome.js';

// Runtime support for the editor's behavior wizard (docs/design/editor.md's
// "Composition wizard") - a generated composition plugin's register(api)
// imports applyRuleOverride from here to apply its ruleOverrides array.
export {
  isEntityTypePinned,
  entityTypesOfFilter,
  widenEntityTypeFilter,
  applyRuleOverride,
} from './ruleOverrides.js';
