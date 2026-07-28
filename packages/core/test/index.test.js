import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFov, fovContains, isWalkableCell, createZone } from '../src/index.js';

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
