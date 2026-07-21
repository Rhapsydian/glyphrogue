import { generateZone } from './mapgen.js';

function applyEntityDiff(zone, entityDiff) {
  switch (entityDiff.op) {
    case 'add':
      zone.entities.push(entityDiff.entity);
      return;
    case 'remove': {
      const index = zone.entities.findIndex(
        (e) => e.type === entityDiff.match.type && e.x === entityDiff.match.x && e.y === entityDiff.match.y,
      );
      if (index !== -1) zone.entities.splice(index, 1);
      return;
    }
    case 'modify': {
      const entity = zone.entities.find(
        (e) => e.type === entityDiff.match.type && e.x === entityDiff.match.x && e.y === entityDiff.match.y,
      );
      if (entity) Object.assign(entity.data, entityDiff.data);
      return;
    }
    default:
      throw new Error(`unknown entityDiff op "${entityDiff.op}"`);
  }
}

// The one diff/overlay mechanism mapgen-and-editor.md says serves both
// author-declared overrides and player-mutation saves: cellOverrides force
// specific cells regardless of what generation produced, entityDiffs
// add/remove/modify blueprint entity placements. Mutates `zone` in place,
// same convention as zoneComposition.js's primitives.
export function applyDiff(zone, diff = {}) {
  const { cellOverrides = [], entityDiffs = [] } = diff;

  for (const { x, y, cell } of cellOverrides) {
    zone.cells[y * zone.width + x] = cell;
  }

  for (const entityDiff of entityDiffs) {
    applyEntityDiff(zone, entityDiff);
  }

  return zone;
}

// The seed+diff save strategy end to end: regenerate a zone deterministically
// from (worldSeed, zoneId), then reapply the saved diff on top - a zone's
// persisted state is `{ generatorId, zoneId, params, diff }`, never the full
// cell grid.
export function loadZone(registry, { diff, ...generateArgs }) {
  const zone = generateZone(registry, generateArgs);
  return applyDiff(zone, diff);
}
