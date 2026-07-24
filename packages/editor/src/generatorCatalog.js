// Enumerates registered map generators for the map editor's generator
// picker (docs/design/editor.md: "Map editor"). The registry is one flat
// namespace shared across every kind (rules, generators, entity types,
// sounds, screens...) - registerGenerator entries are distinguishable only
// by shape ({ generatorFn, paramsDefaults }, mapgen.js), not by any kind
// tag, so this filters by shape rather than reading a dedicated list.
import { getOrderedIds, get } from '@glyphrogue/core';

export function listGeneratorIds(registry) {
  return getOrderedIds(registry).filter((id) => typeof get(registry, id)?.generatorFn === 'function');
}
