import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFov,
  fovContains,
  isWalkableCell,
  createZone,
  fleesRule,
  createApi,
  FLEES_PRIORITY,
  GUARDS_PRIORITY,
  CHASES_PLAYER_PRIORITY,
  WANDERS_PRIORITY,
  DEFAULT_MOVE_COST,
} from '../src/index.js';

// Regression: computeFov/fovContains were implemented and tested (fov.test.js)
// but never added to the public index.js export list, so no downstream
// consumer could import them directly - only api.computeFov's player-FOV-
// bound wrapper was reachable, contradicting rendering.md's "one shared
// primitive, three consumers" intent (light propagation etc. need a raw
// computeFov with their own isOpaque, not api's fixed one).
test('computeFov/fovContains are part of the public @glyphrogue/core surface', () => {
  assert.equal(typeof computeFov, 'function');
  assert.equal(typeof fovContains, 'function');

  const fov = computeFov({ x: 0, y: 0 }, 3, { isOpaque: () => false });
  assert.equal(fovContains(fov, 0, 0), true);
  assert.equal(fovContains(fov, 100, 100), false);
});

// Regression: isWalkableCell (zoneComposition.js) was already exported from
// its own module but never re-exported from index.js, so a downstream game
// authoring a custom generator/rule had no way to reach it without
// reinventing it locally (glyphkeep's game.js independently rebuilt an
// equivalent isWalkableInZone before realizing this already existed).
test('isWalkableCell is part of the public @glyphrogue/core surface', () => {
  assert.equal(typeof isWalkableCell, 'function');

  const zone = createZone(3, 3, 'wall');
  zone.cells[1 * 3 + 1] = 'floor';

  assert.equal(isWalkableCell(zone, 1, 1), true);
  assert.equal(isWalkableCell(zone, 0, 0), false);
  assert.equal(isWalkableCell(zone, -1, 0), false);
  assert.equal(isWalkableCell(zone, 3, 0), false);
});

// Regression: fleesRule (behaviors.js) was implemented and used internally
// by fleesPlugin, but never re-exported raw from index.js - only the
// pre-wrapped plugin (a fixed `components: { all: ['Flees'] }` filter) was
// reachable. A downstream game wanting a tighter filter around the same
// tested movement logic (e.g. "flees only once hurt," combining Flees with
// a health-threshold component filter) had no way to reuse it without
// reimplementing fleeing locally. Found by glyphkeep's Phase 2 slime
// archetype.
test('fleesRule is part of the public @glyphrogue/core surface', () => {
  assert.equal(typeof fleesRule, 'function');

  const api = createApi({ isWalkable: () => true, isOpaque: () => false });
  api.registerRule('flees', 'TakeTurn', fleesRule, { components: { all: ['Flees'] } });

  const player = api.createEntity();
  api.addComponent(player, 'PlayerControlled', {});
  api.addComponent(player, 'Position', { x: 5, y: 5 });

  const fleeing = api.createEntity();
  api.addComponent(fleeing, 'Position', { x: 6, y: 5 });
  api.addComponent(fleeing, 'Flees', {});

  const { resolved } = api.dispatch({ type: 'TakeTurn', entity: fleeing });

  assert.deepEqual(resolved.map((action) => action.type), ['TakeTurn', 'Move']);
});

// Regression: the four behavior priority constants are internal to
// behaviors.js but never re-exported from index.js - a downstream rule
// composing with the real priority ordering had no way to reference it
// without hardcoding a magic number.
test('the four behavior priority constants are part of the public @glyphrogue/core surface', () => {
  assert.equal(typeof FLEES_PRIORITY, 'number');
  assert.equal(typeof GUARDS_PRIORITY, 'number');
  assert.equal(typeof CHASES_PLAYER_PRIORITY, 'number');
  assert.equal(typeof WANDERS_PRIORITY, 'number');
  // Self-preservation beats duty beats aggression beats idling.
  assert.ok(FLEES_PRIORITY > GUARDS_PRIORITY);
  assert.ok(GUARDS_PRIORITY > CHASES_PLAYER_PRIORITY);
  assert.ok(CHASES_PLAYER_PRIORITY > WANDERS_PRIORITY);
});

// Regression: DEFAULT_MOVE_COST is internal to behaviors.js but never
// re-exported - a downstream game's own move/turn costs had no way to stay
// in lockstep with it short of independently redeclaring the same number.
test('DEFAULT_MOVE_COST is part of the public @glyphrogue/core surface', () => {
  assert.equal(typeof DEFAULT_MOVE_COST, 'number');
});
