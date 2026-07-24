import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGlyphMetrics, createFontSourceRegistry, registerFontSource } from '@glyphrogue/core';
import { buildDefaultTileset, zoneToCommands } from '../src/zoneRender.js';

// createZone (zoneComposition.js) isn't on @glyphrogue/core's public
// surface (only reachable via a live api instance) - a plain object literal
// in the documented ZoneDTO shape is enough to exercise zoneToCommands.
function makeContext() {
  const metrics = createGlyphMetrics({ pixelsPerEm: 16 });
  const fontSources = createFontSourceRegistry();
  registerFontSource(fontSources, 'base', { unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: {} });
  const tileset = buildDefaultTileset();
  return { tileset, fontSources, metrics };
}

test('zoneToCommands emits one command per cell, background set from the cell type token', () => {
  const zone = { width: 2, height: 1, cells: ['wall', 'floor'], entities: [] };
  const commands = zoneToCommands(zone, makeContext());

  assert.equal(commands.length, 2);
  assert.deepEqual(
    commands.map((c) => [c.col, c.row]),
    [[0, 0], [1, 0]],
  );
  assert.deepEqual(commands[0].background, { token: 'wall' });
  assert.deepEqual(commands[1].background, { token: 'floor' });
});

test('zoneToCommands falls back to the unknown-cell glyph for an arbitrary/unregistered cell type', () => {
  // e.g. layered-biome's generator-defined biome.cell strings, which aren't
  // in KNOWN_CELL_TYPES and can't be enumerated up front.
  const zone = { width: 1, height: 1, cells: ['lava'], entities: [] };
  const [command] = zoneToCommands(zone, makeContext());

  assert.deepEqual(command.background, { token: 'accent' });
});

test('zoneToCommands appends one command per entity, after all terrain commands, with no background', () => {
  const zone = {
    width: 2,
    height: 1,
    cells: ['floor', 'floor'],
    entities: [{ type: 'goblin', x: 1, y: 0, data: {} }],
  };
  const commands = zoneToCommands(zone, makeContext());

  assert.equal(commands.length, 3);
  const entityCommand = commands[2];
  assert.equal(entityCommand.col, 1);
  assert.equal(entityCommand.row, 0);
  assert.equal(entityCommand.background, undefined);
  assert.notEqual(entityCommand.text, ' ');
});

test('zoneToCommands renders every entity with the same generic glyph regardless of declared type', () => {
  const zone = {
    width: 1,
    height: 1,
    cells: ['floor'],
    entities: [
      { type: 'goblin', x: 0, y: 0, data: {} },
      { type: 'totally-unregistered-type', x: 0, y: 0, data: {} },
    ],
  };
  const [, goblinCommand, unregisteredCommand] = zoneToCommands(zone, makeContext());

  assert.equal(goblinCommand.text, unregisteredCommand.text);
  assert.deepEqual(goblinCommand.color, unregisteredCommand.color);
});
