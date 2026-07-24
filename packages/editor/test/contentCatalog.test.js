import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveManifest, componentIndex, entityTypeRuleIndex, filterManifest } from '../src/contentCatalog.js';

function plugin(id, register) {
  return { id, version: '1.0.0', dependencies: {}, register };
}

test('deriveManifest runs each enabled plugin\'s register(api) against a fresh recording api', () => {
  const plugins = [
    plugin('wanders', (api) =>
      api.registerRule('wanders', 'TakeTurn', () => {}, { components: { all: ['Wanders'] } }),
    ),
    plugin('bsp', (api) => api.registerGenerator('bsp')),
  ];

  const manifest = deriveManifest(plugins);

  assert.deepEqual(manifest.map((entry) => [entry.kind, entry.id]), [
    ['rule', 'wanders'],
    ['generator', 'bsp'],
  ]);
  assert.deepEqual(manifest[0].components, { all: ['Wanders'] });
});

test('componentIndex maps a component name to every rule referencing it, across all/any/none', () => {
  const manifest = [
    { kind: 'rule', id: 'wanders', actionType: 'TakeTurn', components: { all: ['Wanders'] } },
    { kind: 'rule', id: 'flees', actionType: 'TakeTurn', components: { any: ['Wanders', 'Flees'] } },
    { kind: 'rule', id: 'guards', actionType: 'TakeTurn', components: { none: ['Dead'] } },
    { kind: 'generator', id: 'bsp' },
  ];

  const index = componentIndex(manifest);

  assert.deepEqual(
    index.Wanders.map((ref) => ref.ruleId).sort(),
    ['flees', 'wanders'],
  );
  assert.deepEqual(index.Dead, [{ ruleId: 'guards', bucket: 'none' }]);
  assert.equal(index.Flees.length, 1);
});

test('componentIndex resolves object-form filter entries by their component field', () => {
  const manifest = [
    {
      kind: 'rule',
      id: 'low-health',
      actionType: 'TakeTurn',
      components: { all: [{ component: 'Health', lt: { value: 10 } }] },
    },
  ];

  assert.deepEqual(componentIndex(manifest).Health, [{ ruleId: 'low-health', bucket: 'all' }]);
});

test('entityTypeRuleIndex lists every rule whose filter could match an entity type\'s declared components', () => {
  const manifest = [
    { kind: 'rule', id: 'wanders', actionType: 'TakeTurn', components: { all: ['Wanders'] } },
    { kind: 'rule', id: 'chases', actionType: 'TakeTurn', components: { all: ['ChasesPlayer'] } },
    { kind: 'rule', id: 'always', actionType: 'TakeTurn', components: undefined },
    { kind: 'entityType', id: 'goblin', components: ['Wanders', 'Position'] },
  ];

  assert.deepEqual(entityTypeRuleIndex(manifest).goblin.sort(), ['always', 'wanders']);
});

test('entityTypeRuleIndex excludes a rule whose none-bucket names a declared component', () => {
  const manifest = [
    { kind: 'rule', id: 'wanders', actionType: 'TakeTurn', components: { none: ['Dead'] } },
    { kind: 'entityType', id: 'zombie', components: ['Dead'] },
  ];

  assert.deepEqual(entityTypeRuleIndex(manifest).zombie, []);
});

const sampleManifest = [
  { kind: 'rule', id: 'wanders', actionType: 'TakeTurn', components: { all: ['Wanders'] } },
  { kind: 'rule', id: 'chases', actionType: 'TakeTurn', components: { all: ['ChasesPlayer'] } },
  { kind: 'generator', id: 'bsp' },
  { kind: 'entityType', id: 'goblin', components: ['Wanders'] },
];

test('filterManifest narrows by kind facet and free-text search', () => {
  assert.deepEqual(
    filterManifest(sampleManifest, { kinds: ['rule'] }).map((entry) => entry.id),
    ['wanders', 'chases'],
  );
  assert.deepEqual(
    filterManifest(sampleManifest, { search: 'gob' }).map((entry) => entry.id),
    ['goblin'],
  );
});

test('filterManifest\'s referencedComponent mode re-filters to rules referencing that component', () => {
  assert.deepEqual(
    filterManifest(sampleManifest, { referencedComponent: 'Wanders' }).map((entry) => entry.id),
    ['wanders'],
  );
});

test('filterManifest\'s referencedEntityType mode re-filters to rules that would match that type', () => {
  assert.deepEqual(
    filterManifest(sampleManifest, { referencedEntityType: 'goblin' }).map((entry) => entry.id),
    ['wanders'],
  );
});
