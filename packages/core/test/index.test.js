import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFov, fovContains } from '../src/index.js';

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
