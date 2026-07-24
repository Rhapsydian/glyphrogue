import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createZone, createRng } from '@glyphrogue/core';
import {
  addStep,
  removeStep,
  moveStep,
  composeZone,
  composedGeneratorPath,
  isValidExportName,
  generateComposedSource,
} from '../src/compositionSteps.js';

test('addStep/removeStep/moveStep are pure - they never mutate the input array', () => {
  const original = [{ generatorId: 'bsp' }];
  const added = addStep(original, { generatorId: 'cellular-automata' });
  assert.equal(original.length, 1);
  assert.equal(added.length, 2);

  const removed = removeStep(added, 0);
  assert.deepEqual(removed, [{ generatorId: 'cellular-automata' }]);
  assert.equal(added.length, 2);

  const moved = moveStep(added, 1, -1);
  assert.deepEqual(moved, [{ generatorId: 'cellular-automata' }, { generatorId: 'bsp' }]);
  assert.equal(added[0].generatorId, 'bsp');
});

test('moveStep is a no-op when the target index is out of range', () => {
  const steps = [{ generatorId: 'bsp' }, { generatorId: 'wfc' }];
  assert.deepEqual(moveStep(steps, 0, -1), steps);
  assert.deepEqual(moveStep(steps, 1, 1), steps);
});

test('composedGeneratorPath matches the design doc\'s src/generators/composed/<name>.js convention', () => {
  assert.equal(composedGeneratorPath('my-dungeon'), 'src/generators/composed/my-dungeon.js');
});

test('isValidExportName is re-exported from mapEditorExport.js, not duplicated', () => {
  assert.equal(isValidExportName('valid-name_1'), true);
  assert.equal(isValidExportName('not valid!'), false);
});

test('composeZone auto-connects consecutive steps in order, leaving the gap between two disjoint bsp rooms carved', () => {
  const zone = createZone(8, 4);
  // Both regions are smaller than minPartitionSize, so carveBsp never
  // splits - each becomes one deterministic leaf room regardless of rng,
  // making the resulting entry points (and therefore the connectCorridor
  // path) fully predictable: {x:1,y:1} and {x:5,y:1}.
  const steps = [
    {
      generatorId: 'bsp',
      region: { x: 0, y: 0, width: 4, height: 4 },
      params: { minPartitionSize: 6, roomMargin: 1 },
    },
    {
      generatorId: 'bsp',
      region: { x: 4, y: 0, width: 4, height: 4 },
      params: { minPartitionSize: 6, roomMargin: 1 },
    },
  ];

  composeZone(zone, createRng(1), steps);

  // The gap between the two rooms (x=3,4 at y=1) starts as 'wall' - only
  // the auto-connect between step 1's and step 2's entry points carves it.
  assert.equal(zone.cells[1 * 8 + 3], 'floor');
  assert.equal(zone.cells[1 * 8 + 4], 'floor');
});

test('composeZone does not attempt a connect before the first step', () => {
  const zone = createZone(4, 4);
  const steps = [
    {
      generatorId: 'bsp',
      region: { x: 0, y: 0, width: 4, height: 4 },
      params: { minPartitionSize: 6, roomMargin: 1 },
    },
  ];
  // No throw despite there being no "previous" step to connect from.
  assert.doesNotThrow(() => composeZone(zone, createRng(1), steps));
});

test('composeZone returns the same zone instance it mutated', () => {
  const zone = createZone(4, 4);
  const result = composeZone(zone, createRng(1), []);
  assert.equal(result, zone);
});

test('generateComposedSource only imports the primitives actually used by the given steps', () => {
  const source = generateComposedSource(
    [{ generatorId: 'bsp', region: { x: 0, y: 0, width: 4, height: 4 }, params: { minPartitionSize: 6, roomMargin: 1 } }],
    { width: 4, height: 4 }
  );

  assert.match(source, /import \{ createZone, connectCorridor, carveBsp \} from '@glyphrogue\/core';/);
  assert.doesNotMatch(source, /WFC_TILES/);
  assert.doesNotMatch(source, /BIOMES/);
});

test('generateComposedSource emits placeholder consts only for the generators a step list actually uses', () => {
  const wfcOnly = generateComposedSource(
    [{ generatorId: 'wfc', region: { x: 0, y: 0, width: 6, height: 6 }, params: { maxRetries: 50 } }],
    { width: 6, height: 6 }
  );
  assert.match(wfcOnly, /const WFC_TILES = /);
  assert.doesNotMatch(wfcOnly, /const BIOMES = /);

  const biomeOnly = generateComposedSource(
    [{ generatorId: 'layered-biome', region: { x: 0, y: 0, width: 6, height: 6 }, params: { seedCount: 4 } }],
    { width: 6, height: 6 }
  );
  assert.match(biomeOnly, /const BIOMES = /);
  assert.doesNotMatch(biomeOnly, /const WFC_TILES = /);
});

test('generateComposedSource emits exactly one connectCorridor call for a two-step list, none for a one-step list', () => {
  const oneStep = generateComposedSource(
    [{ generatorId: 'bsp', region: { x: 0, y: 0, width: 4, height: 4 }, params: {} }],
    { width: 4, height: 4 }
  );
  assert.equal((oneStep.match(/connectCorridor\(zone, previousEntryPoint, entryPoint\);/g) ?? []).length, 0);

  const twoSteps = generateComposedSource(
    [
      { generatorId: 'bsp', region: { x: 0, y: 0, width: 4, height: 4 }, params: {} },
      { generatorId: 'cellular-automata', region: { x: 4, y: 0, width: 4, height: 4 }, params: {} },
    ],
    { width: 8, height: 4 }
  );
  assert.equal((twoSteps.match(/connectCorridor\(zone, previousEntryPoint, entryPoint\);/g) ?? []).length, 1);
});

test('generateComposedSource on an empty step list still produces a runnable generatorFn that returns an empty zone', () => {
  const source = generateComposedSource([], { width: 5, height: 5 });
  assert.match(source, /export default function generatorFn\(ctx\)/);
  assert.match(source, /return zone;/);
});

test('generateComposedSource output actually runs: round-tripped through a real dynamic import for each generator kind', async (t) => {
  // Written under this package's own test/ dir (not the OS tmpdir) so
  // Node's module resolution can walk up to the workspace's node_modules
  // and actually find @glyphrogue/core from the generated import.
  const dir = await mkdtemp(join(dirname(fileURLToPath(import.meta.url)), '.tmp-composed-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const steps = [
    { generatorId: 'bsp', region: { x: 0, y: 0, width: 10, height: 10 }, params: { minPartitionSize: 6, roomMargin: 1 } },
    {
      generatorId: 'cellular-automata',
      region: { x: 10, y: 0, width: 10, height: 10 },
      params: { fillProbability: 0.45, passes: 4, wallThreshold: 5 },
    },
    { generatorId: 'wfc', region: { x: 20, y: 0, width: 10, height: 10 }, params: { maxRetries: 50 } },
    { generatorId: 'layered-biome', region: { x: 30, y: 0, width: 10, height: 10 }, params: { seedCount: 4 } },
  ];
  const source = generateComposedSource(steps, { width: 40, height: 10 });

  const filePath = join(dir, 'composed.js');
  await writeFile(filePath, source, 'utf8');
  const module = await import(pathToFileURL(filePath).href);

  const zone = module.default({ rng: createRng(42) });

  assert.equal(zone.width, 40);
  assert.equal(zone.height, 10);
  assert.equal(zone.cells.length, 400);
  assert.ok(zone.cells.includes('floor'));
});
