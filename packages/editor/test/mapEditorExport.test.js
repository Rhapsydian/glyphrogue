import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTemplateFragment,
  buildSeedPreset,
  isValidExportName,
  templatePath,
  presetPath,
} from '../src/mapEditorExport.js';

function makeZone() {
  return {
    width: 4,
    height: 4,
    cells: [
      'wall', 'wall', 'wall', 'wall',
      'wall', 'floor', 'floor', 'wall',
      'wall', 'floor', 'floor', 'wall',
      'wall', 'wall', 'wall', 'wall',
    ],
    entities: [
      { type: 'chest', x: 1, y: 1, data: {} },
      { type: 'goblin', x: 3, y: 3, data: {} }, // outside the sub-region used below
    ],
    anchors: [
      { id: 'north-door', x: 1, y: 0 },
      { id: 'south-door', x: 2, y: 3 }, // outside the sub-region used below
    ],
    logicalLinks: [],
  };
}

test('buildTemplateFragment with no bounds exports the whole zone unrebased (bounds already 0,0)', () => {
  const zone = makeZone();
  const fragment = buildTemplateFragment(zone);

  assert.equal(fragment.width, 4);
  assert.equal(fragment.height, 4);
  assert.deepEqual(fragment.cells, zone.cells);
  assert.equal(fragment.entities.length, 2);
  assert.equal(fragment.anchors.length, 2);
  assert.deepEqual(fragment.logicalLinks, []);
});

test('buildTemplateFragment with a sub-region rebases cells/entities/anchors to a local 0,0 origin', () => {
  const zone = makeZone();
  const bounds = { x: 1, y: 1, width: 2, height: 2 };
  const fragment = buildTemplateFragment(zone, bounds);

  assert.equal(fragment.width, 2);
  assert.equal(fragment.height, 2);
  assert.deepEqual(fragment.cells, ['floor', 'floor', 'floor', 'floor']);

  // The chest at (1,1) in zone space is inside bounds -> rebased to (0,0).
  assert.equal(fragment.entities.length, 1);
  assert.deepEqual(fragment.entities[0], { type: 'chest', x: 0, y: 0, data: {} });

  // The goblin at (3,3) is outside bounds -> excluded entirely.
  assert.ok(!fragment.entities.some((e) => e.type === 'goblin'));

  // north-door (1,0) is outside this particular sub-region -> excluded;
  // no anchor survives inside bounds here.
  assert.equal(fragment.anchors.length, 0);
});

test('buildTemplateFragment includes an anchor that falls inside the requested bounds, rebased', () => {
  const zone = makeZone();
  const bounds = { x: 0, y: 0, width: 2, height: 1 };
  const fragment = buildTemplateFragment(zone, bounds);

  assert.equal(fragment.anchors.length, 1);
  assert.deepEqual(fragment.anchors[0], { id: 'north-door', x: 1, y: 0 });
});

test('buildSeedPreset returns exactly the generatorId/seed/params shape', () => {
  const preset = buildSeedPreset({ generatorId: 'bsp', seed: 42, params: { width: 20, height: 12 } });
  assert.deepEqual(preset, { generatorId: 'bsp', seed: 42, params: { width: 20, height: 12 } });
});

test('isValidExportName accepts alphanumerics/underscore/hyphen and rejects everything else', () => {
  assert.ok(isValidExportName('starter-dungeon_01'));
  assert.ok(!isValidExportName(''));
  assert.ok(!isValidExportName('has spaces'));
  assert.ok(!isValidExportName('../escape'));
  assert.ok(!isValidExportName('slash/in/name'));
  assert.ok(!isValidExportName(null));
  assert.ok(!isValidExportName(undefined));
});

test('templatePath/presetPath build the documented src/maps sub-folder paths', () => {
  assert.equal(templatePath('starter-dungeon'), 'src/maps/templates/starter-dungeon.json');
  assert.equal(presetPath('easy-seed'), 'src/maps/presets/easy-seed.json');
});
