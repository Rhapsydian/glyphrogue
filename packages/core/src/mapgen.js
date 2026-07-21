import { register, get } from './registry.js';
import { createRng } from './rng.js';

export function registerGenerator(registry, id, generatorFn, options) {
  register(registry, id, generatorFn, options);
}

// FNV-1a over the (worldSeed, zoneId) pair - deterministic across JS engines
// and versions (no reliance on Math.random, wall-clock, or iteration order),
// so a zone is independently reproducible from its own id alone.
function hashSeed(worldSeed, zoneId) {
  const str = `${worldSeed}:${zoneId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function generateZone(registry, { generatorId, worldSeed, zoneId, params = {}, getNeighborZone }) {
  const generatorFn = get(registry, generatorId);
  if (!generatorFn) {
    throw new Error(`no generator registered under id "${generatorId}"`);
  }

  const rng = createRng(hashSeed(worldSeed, zoneId));
  const ctx = { rng, params, getNeighborZone };

  return generatorFn(ctx);
}
