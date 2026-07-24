import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  resolveContainedPath,
  parseWriteRequest,
  createProvenanceStore,
  parseGitStatusPorcelain,
  parseBootstrapSource,
  isValidPluginId,
} from '../src/devServerPlugin.js';

test('resolveContainedPath resolves an ordinary relative path under the project root', () => {
  const resolved = resolveContainedPath('/project', 'src/maps/overrides/zone1.json');
  assert.equal(resolved, resolve('/project', 'src/maps/overrides/zone1.json'));
});

test('resolveContainedPath throws for a path that escapes the project root', () => {
  assert.throws(() => resolveContainedPath('/project', '../../etc/passwd'), /escapes the project root/);
});

test('resolveContainedPath throws for an absolute path outside the project root', () => {
  assert.throws(() => resolveContainedPath('/project', '/etc/passwd'), /escapes the project root/);
});

test('resolveContainedPath allows the project root itself', () => {
  assert.doesNotThrow(() => resolveContainedPath('/project', '.'));
});

test('parseWriteRequest requires string path and content', () => {
  assert.throws(() => parseWriteRequest({}), /string "path" and "content"/);
  assert.throws(() => parseWriteRequest({ path: 'a.json' }), /string "path" and "content"/);
  assert.throws(() => parseWriteRequest(null), /string "path" and "content"/);
});

test('parseWriteRequest normalizes optional tool/label to undefined when absent or non-string', () => {
  const parsed = parseWriteRequest({ path: 'a.json', content: '{}' });
  assert.equal(parsed.tool, undefined);
  assert.equal(parsed.label, undefined);
});

test('parseWriteRequest passes through tool/label when present', () => {
  const parsed = parseWriteRequest({
    path: 'src/maps/overrides/zone1.json',
    content: '{"cells":[]}',
    tool: 'map-editor',
    label: 'exported override for zone1',
  });
  assert.deepEqual(parsed, {
    path: 'src/maps/overrides/zone1.json',
    content: '{"cells":[]}',
    tool: 'map-editor',
    label: 'exported override for zone1',
  });
});

test('createProvenanceStore records and lists per-path provenance', () => {
  const store = createProvenanceStore();
  assert.deepEqual(store.list(), []);

  store.record('a.json', { tool: 'map-editor', label: 'first' });
  const [entry] = store.list();

  assert.equal(entry.path, 'a.json');
  assert.equal(entry.tool, 'map-editor');
  assert.equal(entry.label, 'first');
  assert.equal(typeof entry.recordedAt, 'number');
});

test('createProvenanceStore records overwrite the prior entry for the same path', () => {
  const store = createProvenanceStore();

  store.record('a.json', { tool: 'map-editor', label: 'first' });
  store.record('a.json', { tool: 'config-ui', label: 'second' });

  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].label, 'second');
});

test('parseGitStatusPorcelain parses one entry per line', () => {
  const output = '?? src/maps/overrides/zone1.json\n M src/maps/presets/goblin-camp.json\n';
  assert.deepEqual(parseGitStatusPorcelain(output), [
    { status: '??', path: 'src/maps/overrides/zone1.json' },
    { status: ' M', path: 'src/maps/presets/goblin-camp.json' },
  ]);
});

test('parseGitStatusPorcelain returns an empty list for clean status output', () => {
  assert.deepEqual(parseGitStatusPorcelain(''), []);
});

test('parseGitStatusPorcelain ignores a trailing blank line', () => {
  assert.deepEqual(parseGitStatusPorcelain('?? a.json\n'), [{ status: '??', path: 'a.json' }]);
});

test('parseBootstrapSource collects named imports from @glyphrogue/core', () => {
  const source = `import {
  createApi,
  loadPlugins,
  bspPlugin,
  wandersPlugin,
} from '@glyphrogue/core';
`;
  const { coreImportNames } = parseBootstrapSource(source);
  assert.deepEqual(coreImportNames, ['createApi', 'loadPlugins', 'bspPlugin', 'wandersPlugin']);
});

test('parseBootstrapSource ignores named imports from a non-core package', () => {
  const source = `import { unmount } from 'svelte';\n`;
  assert.deepEqual(parseBootstrapSource(source).coreImportNames, []);
});

test('parseBootstrapSource resolves an "as" alias to its local name', () => {
  const source = `import { bspPlugin as bsp } from '@glyphrogue/core';\n`;
  assert.deepEqual(parseBootstrapSource(source).coreImportNames, ['bsp']);
});

test('parseBootstrapSource collects default imports as author plugin candidates', () => {
  const source = `import goblinPlugin from './plugins/goblin-ai/index.js';\n`;
  assert.deepEqual(parseBootstrapSource(source).authorImports, [
    { localName: 'goblinPlugin', sourcePath: './plugins/goblin-ai/index.js' },
  ]);
});

test('parseBootstrapSource extracts identifiers from the loadPlugins array', () => {
  const source = `loadPlugins(api, [\n  bspPlugin,\n  wandersPlugin,\n  goblinPlugin,\n]);\n`;
  assert.deepEqual(parseBootstrapSource(source).loadPluginsArrayEntries, [
    'bspPlugin',
    'wandersPlugin',
    'goblinPlugin',
  ]);
});

test('parseBootstrapSource returns empty results for a source with no loadPlugins call', () => {
  assert.deepEqual(parseBootstrapSource('').loadPluginsArrayEntries, []);
});

test('isValidPluginId accepts letters, digits, hyphens, and underscores', () => {
  assert.equal(isValidPluginId('goblin-ai'), true);
  assert.equal(isValidPluginId('my_memory2'), true);
});

test('isValidPluginId rejects a path-traversal attempt', () => {
  assert.equal(isValidPluginId('../../etc'), false);
  assert.equal(isValidPluginId('a/b'), false);
});

test('isValidPluginId rejects empty strings and non-strings', () => {
  assert.equal(isValidPluginId(''), false);
  assert.equal(isValidPluginId(undefined), false);
  assert.equal(isValidPluginId(42), false);
});
