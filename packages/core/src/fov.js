// Recursive shadowcasting (Bjorn Bergstrom's algorithm - rot.js's FOV
// module, cited as prior art in rendering.md, is one well-known port of
// this same technique). Pure function of an isOpaque(x, y) query over the
// map - core owns no grid/zone storage (mapgen-and-editor.md), so opacity
// is entirely the caller's concern, same shape as findPath's isWalkable.
const OCTANT_XX = [1, 0, 0, -1, -1, 0, 0, 1];
const OCTANT_XY = [0, 1, -1, 0, 0, -1, 1, 0];
const OCTANT_YX = [0, 1, 1, 0, 0, -1, -1, 0];
const OCTANT_YY = [1, 0, 0, 1, -1, 0, 0, -1];

function castOctant(cx, cy, row, startSlope, endSlope, radius, octant, isOpaque, visible) {
  if (startSlope < endSlope) return;

  const xx = OCTANT_XX[octant];
  const xy = OCTANT_XY[octant];
  const yx = OCTANT_YX[octant];
  const yy = OCTANT_YY[octant];

  let nextStartSlope = startSlope;

  for (let i = row; i <= radius; i++) {
    const dy = -i;
    let blocked = false;

    for (let dx = -i; dx <= 0; dx++) {
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rSlope) continue;
      if (endSlope > lSlope) break;

      const x = cx + dx * xx + dy * xy;
      const y = cy + dx * yx + dy * yy;

      if (dx * dx + dy * dy <= radius * radius) {
        visible.add(`${x},${y}`);
      }

      const opaque = isOpaque(x, y);

      if (blocked) {
        if (opaque) {
          nextStartSlope = rSlope;
          continue;
        }
        blocked = false;
        startSlope = nextStartSlope;
      } else if (opaque && i < radius) {
        blocked = true;
        castOctant(cx, cy, i + 1, startSlope, lSlope, radius, octant, isOpaque, visible);
        nextStartSlope = rSlope;
      }
    }

    if (blocked) break;
  }
}

// Returns the set of "x,y"-keyed cells visible from `origin` within
// `radius`, given an isOpaque(x, y) query. The origin cell is always
// visible; an opaque cell itself is visible (it's what blocks the view),
// only cells behind it are excluded. Shared by player FOV, per-monster
// perception, and light-source propagation (rendering.md) - one primitive,
// three consumers building different visualizations on top of the same
// visible set.
export function computeFov(origin, radius, { isOpaque }) {
  const { x, y } = origin;
  const visible = new Set([`${x},${y}`]);

  for (let octant = 0; octant < 8; octant++) {
    castOctant(x, y, 1, 1, 0, radius, octant, isOpaque, visible);
  }

  return visible;
}

export function fovContains(fov, x, y) {
  return fov.has(`${x},${y}`);
}
