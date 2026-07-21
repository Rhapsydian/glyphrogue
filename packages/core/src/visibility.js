// FOV/lighting visualization (rendering.md): mapping computeFov's visible
// set to per-cell render treatment - visible/remembered/unknown
// classification plus light level/color. Pure functions taking/returning
// plain Set/Map, no ECS or save-DTO knowledge at all - where a game keeps
// this state (in-memory only, or wired onto an entity via memory.js) is
// entirely the caller's concern.
import { computeFov } from './fov.js';

// Sentinel resolved to an actual color by session 22's palette/token
// system - not a resolved color itself.
export const MEMORY_TONE = { token: 'remembered' };

function key(x, y) {
  return `${x},${y}`;
}

export function classifyVisibility(currentFov, rememberedSet, x, y) {
  const k = key(x, y);
  if (currentFov.has(k)) return 'visible';
  if (rememberedSet.has(k)) return 'remembered';
  return 'unknown';
}

export function updateRemembered(rememberedSet, currentFov) {
  return new Set([...rememberedSet, ...currentFov]);
}

// lightSources: [{ origin: {x,y}, radius, color, intensity }]. Runs
// computeFov per source (light propagation shares the same shadowcasting
// primitive as FOV, per rendering.md's "one primitive, three consumers");
// cells reached by more than one source have their intensity summed, and
// take the color of whichever single source contributes the most.
export function computeLighting(lightSources, { isOpaque }) {
  const level = new Map();
  const dominant = new Map();

  for (const source of lightSources) {
    const fov = computeFov(source.origin, source.radius, { isOpaque });
    for (const k of fov) {
      level.set(k, (level.get(k) ?? 0) + source.intensity);
      const current = dominant.get(k);
      if (!current || source.intensity > current.intensity) {
        dominant.set(k, { intensity: source.intensity, color: source.color });
      }
    }
  }

  const result = new Map();
  for (const [k, total] of level) {
    result.set(k, { level: total, color: dominant.get(k).color });
  }
  return result;
}

export function cellRenderState({ x, y }, { currentFov, remembered, lastKnownLight, lightMap, preserveLastKnownLight = false }) {
  const classification = classifyVisibility(currentFov, remembered, x, y);
  const k = key(x, y);

  if (classification === 'visible') {
    return { classification, light: lightMap.get(k) ?? { level: 0, color: null } };
  }

  if (classification === 'remembered') {
    const light = preserveLastKnownLight ? (lastKnownLight.get(k) ?? MEMORY_TONE) : MEMORY_TONE;
    return { classification, light };
  }

  return { classification, light: null };
}

export function updateLastKnownLight(lastKnownLight, currentFov, lightMap) {
  const next = new Map(lastKnownLight);
  for (const k of currentFov) {
    next.set(k, lightMap.get(k) ?? { level: 0, color: null });
  }
  return next;
}
