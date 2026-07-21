import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createEntity, addComponent } from '../src/world.js';
import { createRegistry, register } from '../src/registry.js';
import { registerRule, dispatch } from '../src/actions.js';

test('a rule only fires for its declared action type', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];

  registerRule(registry, 'log-move', 'Move', () => {
    seen.push('Move');
  });
  registerRule(registry, 'log-attack', 'Attack', () => {
    seen.push('Attack');
  });

  dispatch(world, registry, { type: 'Move' });

  assert.deepEqual(seen, ['Move']);
});

test('a rule returning nothing lets the pipeline continue', () => {
  const world = createWorld();
  const registry = createRegistry();
  const ran = [];

  registerRule(registry, 'first', 'Move', () => {
    ran.push('first');
  });
  registerRule(registry, 'second', 'Move', () => {
    ran.push('second');
  });

  const result = dispatch(world, registry, { type: 'Move' });

  assert.deepEqual(ran, ['first', 'second']);
  assert.equal(result.resolved.length, 1);
  assert.equal(result.vetoed.length, 0);
});

test('multiple rules for the same action type all run and their follow-ons all queue', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerRule(registry, 'rule-a', 'Death', () => ({
    followOn: [{ type: 'DropLoot' }],
  }));
  registerRule(registry, 'rule-b', 'Death', () => ({
    followOn: [{ type: 'PlayDeathAnimation' }],
  }));

  const result = dispatch(world, registry, { type: 'Death' });

  assert.equal(result.resolved.length, 3);
  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['Death', 'DropLoot', 'PlayDeathAnimation'],
  );
});

test('a vetoing rule drops that action into vetoed with no follow-ons queued', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerRule(registry, 'always-veto', 'Attack', () => ({ veto: true }));
  registerRule(registry, 'never-runs', 'Attack', () => ({
    followOn: [{ type: 'Damage' }],
  }));

  const result = dispatch(world, registry, { type: 'Attack' });

  assert.equal(result.resolved.length, 0);
  assert.equal(result.vetoed.length, 1);
  assert.equal(result.vetoed[0].type, 'Attack');
});

test('a veto only rejects that action, not already-resolved siblings/ancestors', () => {
  const world = createWorld();
  const registry = createRegistry();

  // Attack resolves and produces two follow-ons: Damage (which resolves)
  // and a bogus VetoedFollowOn (which a rule rejects).
  registerRule(registry, 'attack-rule', 'Attack', () => ({
    followOn: [{ type: 'Damage' }, { type: 'VetoedFollowOn' }],
  }));
  registerRule(registry, 'reject-bogus', 'VetoedFollowOn', () => ({ veto: true }));

  const result = dispatch(world, registry, { type: 'Attack' });

  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['Attack', 'Damage'],
  );
  assert.deepEqual(
    result.vetoed.map((a) => a.type),
    ['VetoedFollowOn'],
  );
});

test('a follow-on chain resolves in emission order', () => {
  const world = createWorld();
  const registry = createRegistry();
  const entity = createEntity(world);
  addComponent(world, entity, 'ExplodesOnDeath', {});

  registerRule(registry, 'attack-to-damage', 'Attack', (action) => ({
    followOn: [{ type: 'Damage', entity: action.entity }],
  }));
  registerRule(registry, 'damage-to-death', 'Damage', (action) => ({
    followOn: [{ type: 'Death', entity: action.entity }],
  }));
  registerRule(registry, 'death-explodes', 'Death', (action, ctx) => {
    if (!ctx.hasComponent(action.entity, 'ExplodesOnDeath')) return;
    return { followOn: [{ type: 'Explosion', entity: action.entity }] };
  });

  const result = dispatch(world, registry, { type: 'Attack', entity });

  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['Attack', 'Damage', 'Death', 'Explosion'],
  );
});

test('dependsOn controls pipeline evaluation order for the same action type', () => {
  const world = createWorld();
  const registry = createRegistry();
  const order = [];

  // Registered in "wrong" order on purpose: the dependent rule is
  // registered first, declaring a forward-referenced dependency on the
  // rule registered after it.
  registerRule(registry, 'second-rule', 'Move', () => {
    order.push('second-rule');
  }, { dependsOn: ['first-rule'] });
  registerRule(registry, 'first-rule', 'Move', () => {
    order.push('first-rule');
  });

  dispatch(world, registry, { type: 'Move' });

  assert.deepEqual(order, ['first-rule', 'second-rule']);
});
