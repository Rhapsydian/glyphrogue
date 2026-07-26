import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { kebabCase, buildTokenMap, substitute, copyTemplate, targetDirIsUsable } from '../scaffold.js';

test('kebabCase lowercases and hyphenates', () => {
  assert.equal(kebabCase('My Cool Game'), 'my-cool-game');
  assert.equal(kebabCase('  Spacey   Name  '), 'spacey-name');
  assert.equal(kebabCase("Rusty's Dungeon!!"), 'rusty-s-dungeon');
});

test('buildTokenMap derives both tokens from the raw game name', () => {
  const tokens = buildTokenMap('My Cool Game');
  assert.equal(tokens.__GAME_NAME__, 'my-cool-game');
  assert.equal(tokens.__GAME_TITLE__, 'My Cool Game');
});

test('substitute replaces every occurrence of every token', () => {
  const tokens = { __GAME_NAME__: 'my-game', __GAME_TITLE__: 'My Game' };
  const result = substitute('{"name":"__GAME_NAME__","title":"__GAME_TITLE__ (__GAME_TITLE__)"}', tokens);
  assert.equal(result, '{"name":"my-game","title":"My Game (My Game)"}');
});

test('targetDirIsUsable is true for a nonexistent path, true for an empty dir, false for a nonempty dir', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'glyphrogue-cli-test-'));
  try {
    assert.equal(await targetDirIsUsable(join(scratch, 'does-not-exist')), true);

    const emptyDir = join(scratch, 'empty');
    await mkdir(emptyDir);
    assert.equal(await targetDirIsUsable(emptyDir), true);

    const nonEmptyDir = join(scratch, 'nonempty');
    await mkdir(nonEmptyDir);
    await writeFile(join(nonEmptyDir, 'file.txt'), 'hi');
    assert.equal(await targetDirIsUsable(nonEmptyDir), false);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('copyTemplate recursively copies files/dirs and substitutes tokens in both names and contents', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'glyphrogue-cli-test-'));
  try {
    const source = join(scratch, 'source');
    const target = join(scratch, 'target');
    await mkdir(join(source, 'nested'), { recursive: true });
    await writeFile(join(source, 'package.json'), '{"name":"__GAME_NAME__"}');
    await writeFile(join(source, 'nested', '__GAME_NAME__.txt'), 'hello __GAME_TITLE__');

    await copyTemplate(source, target, buildTokenMap('My Cool Game'));

    assert.equal(await readFile(join(target, 'package.json'), 'utf8'), '{"name":"my-cool-game"}');
    assert.equal(
      await readFile(join(target, 'nested', 'my-cool-game.txt'), 'utf8'),
      'hello My Cool Game',
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
