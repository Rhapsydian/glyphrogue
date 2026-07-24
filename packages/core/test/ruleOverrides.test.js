import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import {
  isEntityTypePinned,
  entityTypesOfFilter,
  widenEntityTypeFilter,
  applyRuleOverride,
} from '../src/ruleOverrides.js';

test('isEntityTypePinned is true when a filter entry names the EntityType component, in any bucket', () => {
  assert.equal(isEntityTypePinned({ all: [{ component: 'EntityType', equals: { type: 'guard' } }] }), true);
  assert.equal(isEntityTypePinned({ any: [{ component: 'EntityType', in: { type: ['guard'] } }] }), true);
  assert.equal(isEntityTypePinned({ none: [{ component: 'EntityType', equals: { type: 'guard' } }] }), true);
});

test('isEntityTypePinned is false for a plain marker-component filter or no filter', () => {
  assert.equal(isEntityTypePinned({ all: ['Wanders'] }), false);
  assert.equal(isEntityTypePinned(undefined), false);
});

test('entityTypesOfFilter resolves equals to a single-item list and in to its declared list', () => {
  assert.deepEqual(entityTypesOfFilter({ all: [{ component: 'EntityType', equals: { type: 'guard' } }] }), ['guard']);
  assert.deepEqual(
    entityTypesOfFilter({ all: [{ component: 'EntityType', in: { type: ['guard', 'sentry'] } }] }),
    ['guard', 'sentry'],
  );
});

test('widenEntityTypeFilter replaces the EntityType entry with an in-operator covering the full list, preserving other entries', () => {
  const filter = {
    all: [{ component: 'EntityType', equals: { type: 'guard' } }, { component: 'Health', gt: { value: 0 } }],
  };

  const widened = widenEntityTypeFilter(filter, ['guard', 'sentry']);

  assert.deepEqual(widened, {
    all: [{ component: 'EntityType', in: { type: ['guard', 'sentry'] } }, { component: 'Health', gt: { value: 0 } }],
  });
});

test('widenEntityTypeFilter adds an EntityType entry to `all` when the filter has none yet', () => {
  const widened = widenEntityTypeFilter({ all: ['Wanders'] }, ['guard']);
  assert.deepEqual(widened, { all: ['Wanders', { component: 'EntityType', in: { type: ['guard'] } }] });
});

test('applyRuleOverride("attach-component") adds a component to an entity type\'s declared list without disturbing existing ones', () => {
  const api = createApi();
  api.registerEntity('guard', { components: { Position: { x: 0, y: 0 } } });

  applyRuleOverride(api, { kind: 'attach-component', entityId: 'guard', component: 'Wanders', data: {} });

  assert.deepEqual(api.getEntityDefinition('guard').components, {
    Position: { x: 0, y: 0 },
    Wanders: {},
  });
});

test('applyRuleOverride("widen-rule-types") preserves the original ruleFn/priority while widening components', () => {
  const api = createApi();
  const acted = [];
  const ruleFn = (action) => { acted.push(action.entity); };
  api.registerRule('alarm', 'TakeTurn', ruleFn, {
    priority: 7,
    components: { all: [{ component: 'EntityType', equals: { type: 'guard' } }] },
  });

  applyRuleOverride(api, { kind: 'widen-rule-types', ruleId: 'alarm', types: ['guard', 'sentry'] });

  const rule = api.getRule('alarm');
  assert.equal(rule.ruleFn, ruleFn);
  assert.equal(rule.priority, 7);
  assert.deepEqual(rule.components, { all: [{ component: 'EntityType', in: { type: ['guard', 'sentry'] } }] });

  const sentry = api.createEntity();
  api.addComponent(sentry, 'EntityType', { type: 'sentry' });
  api.addActor(sentry, 100);
  api.act();

  assert.deepEqual(acted, [sentry]);
});

test('applyRuleOverride throws for an unknown entry kind', () => {
  const api = createApi();
  assert.throws(() => applyRuleOverride(api, { kind: 'bogus' }), /unknown entry kind "bogus"/);
});
