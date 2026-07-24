import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createApi } from '@glyphrogue/core';
import {
  isValidExportName,
  pluginFilePath,
  discoverCompositions,
  attachableBehaviors,
  widenableRules,
  canDeleteComposition,
  generateCompositionSource,
  generateCustomRuleSource,
} from '../src/behaviorWizard.js';

function contentEntry(overrides) {
  return { id: 'x', version: '1.0.0', source: 'core', kind: 'content', enabled: false, dependencies: {}, ...overrides };
}

test('isValidExportName is re-exported from mapEditorExport.js, not duplicated', () => {
  assert.equal(isValidExportName('valid-name_1'), true);
  assert.equal(isValidExportName('not valid!'), false);
});

test('pluginFilePath matches the folder-per-plugin convention', () => {
  assert.equal(pluginFilePath('guard-patrol'), 'src/plugins/guard-patrol/index.js');
});

test('discoverCompositions finds candidates carrying a ruleOverrides export and computes their enabled state', async () => {
  const entries = [{ kind: 'attach-component', entityId: 'guard', component: 'Wanders', data: {} }];
  const candidates = [
    { id: 'guard-patrol', url: '/src/plugins/guard-patrol/index.js' },
    { id: 'goblin-ai', url: '/src/plugins/goblin-ai/index.js' },
  ];
  const bootstrap = {
    coreImportNames: [],
    authorImports: [{ localName: 'guardPatrolPlugin', sourcePath: './plugins/guard-patrol/index.js' }],
    loadPluginsArrayEntries: ['guardPatrolPlugin'],
  };

  const compositions = await discoverCompositions(
    { candidates, bootstrap },
    {
      importModule: async (url) =>
        url.includes('guard-patrol')
          ? { default: { id: 'guard-patrol' }, ruleOverrides: entries }
          : { default: { id: 'goblin-ai' }, register: () => {} },
    },
  );

  assert.equal(compositions.length, 1);
  assert.equal(compositions[0].id, 'guard-patrol');
  assert.deepEqual(compositions[0].entries, entries);
  assert.equal(compositions[0].enabled, true);
});

test('attachableBehaviors returns a global marker rule the entity doesn\'t yet match, with the missing component named', () => {
  const content = [
    contentEntry({ id: 'wanders', actionType: 'TakeTurn', components: { all: ['Wanders'] } }),
  ];

  const results = attachableBehaviors(['Position', 'Health'], content);

  assert.equal(results.length, 1);
  assert.equal(results[0].entry.id, 'wanders');
  assert.deepEqual(results[0].missingComponents, ['Wanders']);
});

test('attachableBehaviors includes disabled candidates too - not scoped to already-enabled ones', () => {
  const content = [contentEntry({ id: 'wanders', actionType: 'TakeTurn', enabled: false, components: { all: ['Wanders'] } })];
  assert.equal(attachableBehaviors([], content).length, 1);
});

test('attachableBehaviors excludes entity-type-pinned rules - they can never newly match a different type by adding components', () => {
  const content = [
    contentEntry({
      id: 'alarm',
      actionType: 'TakeTurn',
      components: { all: [{ component: 'EntityType', equals: { type: 'guard' } }] },
    }),
  ];
  assert.equal(attachableBehaviors(['Position'], content).length, 0);
});

test('attachableBehaviors excludes a rule that already fully matches - it\'s already applying, not attachable', () => {
  const content = [contentEntry({ id: 'wanders', actionType: 'TakeTurn', components: { all: ['Wanders'] } })];
  assert.equal(attachableBehaviors(['Wanders'], content).length, 0);
});

test('attachableBehaviors excludes a rule whose none-bucket already conflicts with a declared component', () => {
  const content = [contentEntry({ id: 'guards', actionType: 'TakeTurn', components: { all: ['Guards'], none: ['Dead'] } })];
  assert.equal(attachableBehaviors(['Dead'], content).length, 0);
});

test('attachableBehaviors excludes a rule with an any-bucket satisfied by nothing the entity has or could gain generically', () => {
  const content = [contentEntry({ id: 'flees', actionType: 'TakeTurn', components: { any: ['Wanders', 'Flees'] } })];
  assert.equal(attachableBehaviors(['Position'], content).length, 0);
});

test('attachableBehaviors excludes non-rule content (no actionType) and service entries', () => {
  const content = [
    contentEntry({ id: 'bsp', kind: 'content', actionType: undefined }),
    contentEntry({ id: 'memory', kind: 'service', actionType: undefined }),
  ];
  assert.equal(attachableBehaviors(['Position'], content).length, 0);
});

test('widenableRules returns entity-type-pinned rules not yet covering the target type, with currentTypes/nextTypes', () => {
  const content = [
    contentEntry({
      id: 'alarm',
      actionType: 'TakeTurn',
      components: { all: [{ component: 'EntityType', equals: { type: 'guard' } }] },
    }),
  ];

  const results = widenableRules('sentry', content);

  assert.equal(results.length, 1);
  assert.deepEqual(results[0].currentTypes, ['guard']);
  assert.deepEqual(results[0].nextTypes, ['guard', 'sentry']);
});

test('widenableRules excludes a rule that already covers the target type', () => {
  const content = [
    contentEntry({
      id: 'alarm',
      actionType: 'TakeTurn',
      components: { all: [{ component: 'EntityType', in: { type: ['guard', 'sentry'] } }] },
    }),
  ];
  assert.equal(widenableRules('sentry', content).length, 0);
});

test('widenableRules excludes plain global marker rules - only type-pinned rules are widenable', () => {
  const content = [contentEntry({ id: 'wanders', actionType: 'TakeTurn', components: { all: ['Wanders'] } })];
  assert.equal(widenableRules('sentry', content).length, 0);
});

test('canDeleteComposition is ok only when empty, disabled, and nothing depends on it', () => {
  const all = [contentEntry({ id: 'guard-patrol', dependencies: {} })];
  assert.deepEqual(canDeleteComposition({ id: 'guard-patrol', entries: [], enabled: false }, all), {
    ok: true,
    reasons: [],
  });
});

test('canDeleteComposition refuses when the composition still has entries', () => {
  const result = canDeleteComposition({ id: 'guard-patrol', entries: [{ kind: 'attach-component' }], enabled: false }, []);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('composition is not empty'));
});

test('canDeleteComposition refuses when the composition is still enabled', () => {
  const result = canDeleteComposition({ id: 'guard-patrol', entries: [], enabled: true }, []);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('composition is still enabled'));
});

test('canDeleteComposition refuses when another discovered candidate depends on it', () => {
  const all = [contentEntry({ id: 'other-plugin', dependencies: { 'guard-patrol': '^1.0.0' } })];
  const result = canDeleteComposition({ id: 'guard-patrol', entries: [], enabled: false }, all);
  assert.equal(result.ok, false);
  assert.ok(result.reasons[0].includes('other-plugin'));
});

test('generateCompositionSource embeds the entries array and id/version verbatim', () => {
  const entries = [{ kind: 'attach-component', entityId: 'guard', component: 'Wanders', data: {} }];
  const source = generateCompositionSource({ id: 'guard-patrol', entries, version: '1.0.0' });

  assert.match(source, /import \{ applyRuleOverride, CORE_API_VERSION \} from '@glyphrogue\/core';/);
  assert.match(source, /id: "guard-patrol"/);
  assert.match(source, /"kind": "attach-component"/);
  assert.match(source, /for \(const entry of ruleOverrides\) applyRuleOverride\(api, entry\);/);
});

test('generateCompositionSource output actually runs: round-tripped through a real dynamic import', async (t) => {
  const dir = await mkdtemp(join(dirname(fileURLToPath(import.meta.url)), '.tmp-composition-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const entries = [{ kind: 'attach-component', entityId: 'guard', component: 'Wanders', data: {} }];
  const source = generateCompositionSource({ id: 'guard-patrol', entries });

  const filePath = join(dir, 'composition.js');
  await writeFile(filePath, source, 'utf8');
  const module = await import(pathToFileURL(filePath).href);

  assert.equal(module.default.id, 'guard-patrol');
  assert.deepEqual(module.ruleOverrides, entries);

  const api = createApi();
  api.registerEntity('guard', { components: { Position: { x: 0, y: 0 } } });
  module.default.register(api);

  assert.deepEqual(api.getEntityDefinition('guard').components, { Position: { x: 0, y: 0 }, Wanders: {} });
});

test('generateCustomRuleSource embeds a TODO handler and the given filter', () => {
  const source = generateCustomRuleSource({
    pluginId: 'guard-alarm',
    ruleId: 'guard-alarm',
    actionType: 'TakeTurn',
    components: { all: [{ component: 'EntityType', equals: { type: 'guard' } }] },
  });

  assert.match(source, /TODO: implement this rule/);
  assert.match(source, /api\.registerRule\("guard-alarm", "TakeTurn"/);
  assert.match(source, /"EntityType"/);
});

test('generateCustomRuleSource output actually runs and registers a rule matching the given filter', async (t) => {
  const dir = await mkdtemp(join(dirname(fileURLToPath(import.meta.url)), '.tmp-custom-rule-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const source = generateCustomRuleSource({
    pluginId: 'guard-alarm',
    ruleId: 'guard-alarm',
    actionType: 'TakeTurn',
    components: { all: ['Wanders'] },
  });

  const filePath = join(dir, 'custom-rule.js');
  await writeFile(filePath, source, 'utf8');
  const module = await import(pathToFileURL(filePath).href);

  const api = createApi();
  module.default.register(api);

  assert.deepEqual(api.getRule('guard-alarm').components, { all: ['Wanders'] });
  assert.equal(api.getRule('guard-alarm').actionType, 'TakeTurn');
});
