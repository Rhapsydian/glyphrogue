import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { resolveContainedPath, parseWriteRequest, createProvenanceStore } from '../src/devServerPlugin.js';

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
