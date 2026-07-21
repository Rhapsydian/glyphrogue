const cellKey = (x, y) => `${x},${y}`;

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function neighborsOf(x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

// A* over 4-directional adjacency, Manhattan heuristic, given a caller-
// injected isWalkable(x, y) query - core owns no grid/zone storage
// (mapgen-and-editor.md), so walkability is entirely the caller's concern,
// the same shape computeFov takes isOpaque. Returns the ordered steps from
// `from` to `to` (exclusive of `from`, inclusive of `to`), `[]` if
// `from`/`to` are the same cell, or `null` if `to` is unreachable.
//
// isWalkable must reject out-of-bounds cells (the way
// zoneComposition.js's isWalkableCell already does) - an unbounded
// isWalkable turns an unreachable goal into an unbounded search.
export function findPath(from, to, { isWalkable, maxNodes = Infinity } = {}) {
  const startKey = cellKey(from.x, from.y);
  const goalKey = cellKey(to.x, to.y);

  if (startKey === goalKey) return [];
  if (!isWalkable(to.x, to.y)) return null;

  const open = new Map([[startKey, { x: from.x, y: from.y }]]);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, manhattan(from, to)]]);
  const closed = new Set();

  let visited = 0;

  while (open.size > 0) {
    let currentKey;
    let current;
    let bestF = Infinity;
    for (const [key, point] of open) {
      const f = fScore.get(key);
      if (f < bestF) {
        bestF = f;
        currentKey = key;
        current = point;
      }
    }

    if (currentKey === goalKey) {
      const path = [];
      let key = currentKey;
      let point = current;
      while (key !== startKey) {
        path.unshift(point);
        const prev = cameFrom.get(key);
        key = cellKey(prev.x, prev.y);
        point = prev;
      }
      return path;
    }

    open.delete(currentKey);
    closed.add(currentKey);
    visited++;
    if (visited > maxNodes) return null;

    for (const neighbor of neighborsOf(current.x, current.y)) {
      const neighborKey = cellKey(neighbor.x, neighbor.y);
      if (closed.has(neighborKey)) continue;
      if (!isWalkable(neighbor.x, neighbor.y)) continue;

      const tentativeG = gScore.get(currentKey) + 1;
      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + manhattan(neighbor, to));
        open.set(neighborKey, neighbor);
      }
    }
  }

  return null;
}
