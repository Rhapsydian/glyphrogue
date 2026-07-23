import { createZone, stampTemplate, connectCorridor, runConnectivityPass } from './zoneComposition.js';

export const DEFAULT_MIN_PARTITION_SIZE = 6;
export const DEFAULT_ROOM_MARGIN = 1;

// Splits `region` along one axis, at a random position that keeps both
// children >= minPartitionSize. Returns null once neither axis has room
// left to split - that region becomes a leaf.
function splitRegion(rng, region, minPartitionSize) {
  const canSplitVertical = region.width >= minPartitionSize * 2;
  const canSplitHorizontal = region.height >= minPartitionSize * 2;

  if (!canSplitVertical && !canSplitHorizontal) return null;

  const splitVertical = canSplitVertical && (!canSplitHorizontal || rng.next() < 0.5);

  if (splitVertical) {
    const min = region.x + minPartitionSize;
    const max = region.x + region.width - minPartitionSize;
    const splitX = min + Math.floor(rng.next() * (max - min));
    return [
      { x: region.x, y: region.y, width: splitX - region.x, height: region.height },
      { x: splitX, y: region.y, width: region.x + region.width - splitX, height: region.height },
    ];
  }

  const min = region.y + minPartitionSize;
  const max = region.y + region.height - minPartitionSize;
  const splitY = min + Math.floor(rng.next() * (max - min));
  return [
    { x: region.x, y: region.y, width: region.width, height: splitY - region.y },
    { x: region.x, y: splitY, width: region.width, height: region.y + region.height - splitY },
  ];
}

// A leaf's room is inset by roomMargin from the partition edges, clamped to
// at least a 1x1 floor so a pathological margin/size combination can't carve
// nothing at all.
function carveRoom(zone, region, roomMargin) {
  const x = region.x + roomMargin;
  const y = region.y + roomMargin;
  const width = Math.max(1, region.width - roomMargin * 2);
  const height = Math.max(1, region.height - roomMargin * 2);

  for (let ry = y; ry < y + height; ry++) {
    for (let rx = x; rx < x + width; rx++) {
      zone.cells[ry * zone.width + rx] = 'floor';
    }
  }

  const center = { x: x + Math.floor((width - 1) / 2), y: y + Math.floor((height - 1) / 2) };
  return { x, y, width, height, center };
}

// Recursively splits/carves `region`, connecting sibling subtrees on the way
// back up (the classic BSP connect-on-merge approach) - this is what
// guarantees every room ends up connected to every other, independent of any
// later connectivity pass. Returns a representative point for the caller to
// connect against (the region's own room center for a leaf, propagated up
// from a child otherwise).
function buildBsp(zone, rng, region, minPartitionSize, roomMargin, rooms) {
  const children = splitRegion(rng, region, minPartitionSize);

  if (!children) {
    const room = carveRoom(zone, region, roomMargin);
    rooms.push(room);
    return room.center;
  }

  const [regionA, regionB] = children;
  const pointA = buildBsp(zone, rng, regionA, minPartitionSize, roomMargin, rooms);
  const pointB = buildBsp(zone, rng, regionB, minPartitionSize, roomMargin, rooms);
  connectCorridor(zone, pointA, pointB);
  return pointA;
}

// BSP (Binary Space Partitioning), scoped to `region` so an author can carve
// a BSP dungeon into part of a zone and something else (e.g. a CA cave) into
// the rest - see mapgen-and-editor.md's "compose more than one algorithm in
// sequence" framing. Returns room bounds/centers and an entry point so the
// caller has anchor points to connectCorridor against an adjacent region.
export function carveBsp(zone, rng, options = {}) {
  const {
    region = { x: 0, y: 0, width: zone.width, height: zone.height },
    minPartitionSize = DEFAULT_MIN_PARTITION_SIZE,
    roomMargin = DEFAULT_ROOM_MARGIN,
  } = options;

  const rooms = [];
  const entryPoint = buildBsp(zone, rng, region, minPartitionSize, roomMargin, rooms);

  return { rooms, entryPoint };
}

// Thin whole-zone wrapper over carveBsp, registerable as-is via
// registerGenerator - not auto-wired onto createApi(), same as every other
// built-in generator (a generator id is content, not infrastructure).
export function bspGenerator(ctx) {
  const { width, height, minPartitionSize, roomMargin, stamps = [] } = ctx.params ?? {};
  if (!width || !height) {
    throw new Error('bspGenerator requires params.width and params.height');
  }

  const zone = createZone(width, height);
  const { entryPoint } = carveBsp(zone, ctx.rng, { minPartitionSize, roomMargin });
  zone.anchors.push({ id: 'entry', x: entryPoint.x, y: entryPoint.y });

  const stampRecords = stamps.map((stamp) => stampTemplate(zone, stamp.template, stamp));
  runConnectivityPass(zone, { entryPoints: [entryPoint], stamps: stampRecords });

  return zone;
}
