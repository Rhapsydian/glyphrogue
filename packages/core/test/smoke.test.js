import { test } from 'node:test';
import assert from 'node:assert/strict';

test('package entry point resolves', async () => {
  const mod = await import('../src/index.js');
  assert.ok(mod);
});
