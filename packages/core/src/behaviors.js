import { fovContains } from './fov.js';

// First-party TakeTurn rules (ai-and-behavior.md): AI as rules on the
// existing action/rule pipeline, matched by marker component via
// registerRule's own `components` filter (session 28) rather than a
// hand-rolled `if (!ctx.hasComponent(...)) return;` guard inside the rule
// body - the filter stops a non-matching entity's turn from invoking the
// rule at all, so the rule body itself can assume the marker is present.
// Not auto-registered onto createApi() - same precedent as
// bspGenerator/cellularAutomataGenerator etc: "a generator id is content,
// not infrastructure." behaviorPlugins.js is what actually calls
// api.registerRule('wanders', 'TakeTurn', wandersRule, { priority:
// WANDERS_PRIORITY, components: { all: ['Wanders'] } }) for each of these.
//
// Fixed default priorities per the design doc - self-preservation beats
// duty beats aggression beats idling.
export const FLEES_PRIORITY = 3;
export const GUARDS_PRIORITY = 2;
export const CHASES_PLAYER_PRIORITY = 1;
export const WANDERS_PRIORITY = 0;

export const DEFAULT_MOVE_COST = 100;

const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
];

function moveFollowOn(entity, to) {
  return { followOn: [{ type: 'Move', entity, to, cost: DEFAULT_MOVE_COST }] };
}

function findVisiblePlayer(ctx, position, radius) {
  const [player] = ctx.query(['PlayerControlled', 'Position']);
  if (player === undefined) return undefined;

  const playerPosition = ctx.getComponent(player, 'Position');
  const fov = ctx.computeFov(position, radius);
  if (!fovContains(fov, playerPosition.x, playerPosition.y)) return undefined;

  return playerPosition;
}

// No perception - deterministically cycles through the four orthogonal
// directions (starting from wherever it left off, stored on the entity's
// own Wanders component data) and takes the first one that's walkable and
// reachable. Reuses ctx.findPath as the walkability check for an adjacent
// cell rather than requiring a separate raw isWalkable on ctx - one
// primitive, not a second one just for this. No-ops if every direction is
// blocked.
export function wandersRule(action, ctx) {
  const position = ctx.getComponent(action.entity, 'Position');
  const wanders = ctx.getComponent(action.entity, 'Wanders') ?? {};
  const startIndex = wanders.lastDirection ?? 0;

  for (let offset = 0; offset < DIRECTIONS.length; offset++) {
    const index = (startIndex + offset) % DIRECTIONS.length;
    const { dx, dy } = DIRECTIONS[index];
    const to = { x: position.x + dx, y: position.y + dy };
    const path = ctx.findPath(position, to);

    if (path && path.length > 0) {
      ctx.addComponent(action.entity, 'Wanders', { ...wanders, lastDirection: (index + 1) % DIRECTIONS.length });
      return moveFollowOn(action.entity, path[0]);
    }
  }

  return undefined;
}

// Perception via the shared FOV primitive (rendering.md: "a ChasesPlayer
// rule already has a visible-tiles query available"), then the shared
// findPath primitive toward the player's current position. No memory of a
// last-known position - out of sight is a no-op, letting a lower-priority
// behavior (Wanders) win instead.
export function chasesPlayerRule(action, ctx) {
  const { radius = 8 } = ctx.getComponent(action.entity, 'ChasesPlayer') ?? {};
  const position = ctx.getComponent(action.entity, 'Position');
  const playerPosition = findVisiblePlayer(ctx, position, radius);
  if (!playerPosition) return undefined;

  const path = ctx.findPath(position, playerPosition);
  if (!path || path.length === 0) return undefined;

  return moveFollowOn(action.entity, path[0]);
}

// Same visibility check as chasesPlayerRule, but greedily steps toward
// whichever walkable orthogonal neighbor maximizes distance from the
// player - not findPath-based, since fleeing has no single destination for
// A* to path toward, just an away-ness gradient. Manhattan distance under
// a unit step is always tied between at least two of the four directions
// (moving away on either axis increases distance by exactly 1); ties
// resolve to whichever direction comes first in DIRECTIONS, deterministic
// but not a claim of a single "most away" direction existing.
export function fleesRule(action, ctx) {
  const { radius = 8 } = ctx.getComponent(action.entity, 'Flees') ?? {};
  const position = ctx.getComponent(action.entity, 'Position');
  const playerPosition = findVisiblePlayer(ctx, position, radius);
  if (!playerPosition) return undefined;

  let best;
  let bestDistance = -Infinity;

  for (const { dx, dy } of DIRECTIONS) {
    const to = { x: position.x + dx, y: position.y + dy };
    const path = ctx.findPath(position, to);
    if (!path || path.length === 0) continue;

    const distance = Math.abs(to.x - playerPosition.x) + Math.abs(to.y - playerPosition.y);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = to;
    }
  }

  if (!best) return undefined;

  return moveFollowOn(action.entity, best);
}

// Component data carries a fixed `post: {x, y}`. Paths back via the
// shared findPath primitive when away from post; no-ops once there. No
// aggro/attack logic - out of scope, same boundary the design doc draws
// around battle-screen-internal AI.
export function guardsRule(action, ctx) {
  const guards = ctx.getComponent(action.entity, 'Guards');

  const position = ctx.getComponent(action.entity, 'Position');
  if (position.x === guards.post.x && position.y === guards.post.y) return undefined;

  const path = ctx.findPath(position, guards.post);
  if (!path || path.length === 0) return undefined;

  return moveFollowOn(action.entity, path[0]);
}
