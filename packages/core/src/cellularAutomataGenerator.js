import {
  createZone,
  carveCellularAutomata,
  stampTemplate,
  nearestOpenCell,
  ensureTraversable,
  runConnectivityPass,
} from './zoneComposition.js';

// Thin whole-zone wrapper over session 18's carveCellularAutomata primitive,
// not a reimplementation - registerable as-is via registerGenerator, same as
// every other built-in generator.
export function cellularAutomataGenerator(ctx) {
  const {
    width,
    height,
    fillProbability,
    passes,
    wallThreshold,
    stamps = [],
    pruneUnreachable = true,
  } = ctx.params ?? {};

  if (!width || !height) {
    throw new Error('cellularAutomataGenerator requires params.width and params.height');
  }

  const zone = createZone(width, height);
  carveCellularAutomata(zone, ctx.rng, { fillProbability, passes, wallThreshold });

  const entry = nearestOpenCell(zone, { x: 0, y: 0, width, height });
  zone.anchors.push({ id: 'entry', x: entry.x, y: entry.y });

  const stampRecords = stamps.map((stamp) => stampTemplate(zone, stamp.template, stamp));

  // Raw CA carving is well known to produce disconnected floor pockets;
  // pruning them to wall is the standard cave-gen fix. pruneUnreachable:
  // false skips it (still validating/auto-connecting stamps via the plain
  // connectivity pass) for a caller that wants the raw carve's pockets left
  // alone.
  if (pruneUnreachable) {
    ensureTraversable(zone, { entryPoints: [entry], stamps: stampRecords, mode: 'prune' });
  } else {
    runConnectivityPass(zone, { entryPoints: [entry], stamps: stampRecords });
  }

  return zone;
}
