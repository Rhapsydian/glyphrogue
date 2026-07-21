// Optional convenience: wires visibility.js's pure remembered-cells/
// last-known-light bookkeeping onto a first-party `Memory` ECS component.
// Nothing else in core depends on this module - an author who wants a
// different persistence strategy (or none) simply doesn't use it, same
// "first-party but not mandatory" precedent as behaviors.js's
// Wanders/ChasesPlayer/Flees/Guards. Using it means exploration memory
// rides along for free in save.js's generic component serialization;
// ignoring it, a game manages its own persistence with zero coupling here.
import { updateRemembered, updateLastKnownLight } from './visibility.js';

export const MEMORY_COMPONENT = 'Memory';

// ctx: the { hasComponent, getComponent, addComponent } shape rules/api
// already expose. Creates an empty Memory component on first use; returns
// the existing one on subsequent calls without resetting it.
export function ensureMemory(ctx, entity) {
  if (!ctx.hasComponent(entity, MEMORY_COMPONENT)) {
    ctx.addComponent(entity, MEMORY_COMPONENT, { remembered: new Set(), lastKnownLight: new Map() });
  }
  return ctx.getComponent(entity, MEMORY_COMPONENT);
}

export function updateEntityMemory(ctx, entity, currentFov, lightMap, { preserveLastKnownLight = false } = {}) {
  const memory = ensureMemory(ctx, entity);
  const remembered = updateRemembered(memory.remembered, currentFov);
  const lastKnownLight = preserveLastKnownLight
    ? updateLastKnownLight(memory.lastKnownLight, currentFov, lightMap)
    : memory.lastKnownLight;

  ctx.addComponent(entity, MEMORY_COMPONENT, { remembered, lastKnownLight });
  return { remembered, lastKnownLight };
}
