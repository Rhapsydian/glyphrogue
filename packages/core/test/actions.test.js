import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createEntity, addComponent } from '../src/world.js';
import { createRegistry, register } from '../src/registry.js';
import { registerRule, dispatch, dispatchExclusive } from '../src/actions.js';
import { createRenderEventQueue } from '../src/renderEvents.js';
import { createScheduler } from '../src/scheduler.js';

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

test('dispatchExclusive: highest-priority matching rule wins, others never apply', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerRule(registry, 'wanders', 'TakeTurn', () => ({
    followOn: [{ type: 'Wander' }],
  }), { priority: 1 });
  registerRule(registry, 'flees', 'TakeTurn', () => ({
    followOn: [{ type: 'Flee' }],
  }), { priority: 10 });
  registerRule(registry, 'guards', 'TakeTurn', () => ({
    followOn: [{ type: 'Guard' }],
  }), { priority: 5 });

  const result = dispatchExclusive(world, registry, { type: 'TakeTurn' });

  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['TakeTurn', 'Flee'],
  );
});

test('dispatchExclusive: constant and function priorities both resolve', () => {
  const world = createWorld();
  const registry = createRegistry();
  const entity = createEntity(world);
  addComponent(world, entity, 'Health', { current: 2, max: 10 });

  registerRule(registry, 'guards', 'TakeTurn', () => ({
    followOn: [{ type: 'Guard' }],
  }), { priority: 5 });
  registerRule(registry, 'flees-when-hurt', 'TakeTurn', () => ({
    followOn: [{ type: 'Flee' }],
  }), {
    priority: (action, ctx) => (10 - ctx.getComponent(action.entity, 'Health').current),
  });

  const result = dispatchExclusive(world, registry, { type: 'TakeTurn', entity });

  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['TakeTurn', 'Flee'],
  );
});

test('dispatchExclusive: equal priority resolves to the earlier-registered rule', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerRule(registry, 'first', 'TakeTurn', () => ({
    followOn: [{ type: 'First' }],
  }), { priority: 5 });
  registerRule(registry, 'second', 'TakeTurn', () => ({
    followOn: [{ type: 'Second' }],
  }), { priority: 5 });

  const result = dispatchExclusive(world, registry, { type: 'TakeTurn' });

  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['TakeTurn', 'First'],
  );
});

test('dispatchExclusive: a non-matching rule is never a candidate regardless of priority', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerRule(registry, 'never-applies', 'TakeTurn', () => undefined, { priority: 1000 });
  registerRule(registry, 'wanders', 'TakeTurn', () => ({
    followOn: [{ type: 'Wander' }],
  }), { priority: 1 });

  const result = dispatchExclusive(world, registry, { type: 'TakeTurn' });

  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['TakeTurn', 'Wander'],
  );
});

test('ctx.findPath uses the mapQuery injected into dispatch()', () => {
  const world = createWorld();
  const registry = createRegistry();
  let foundPath;

  registerRule(registry, 'pathing-rule', 'TakeTurn', (action, ctx) => {
    foundPath = ctx.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
  });

  dispatch(world, registry, { type: 'TakeTurn' }, { isWalkable: () => true });

  assert.deepEqual(foundPath, [{ x: 1, y: 0 }, { x: 2, y: 0 }]);
});

test('ctx.computeFov uses the mapQuery injected into dispatchExclusive()', () => {
  const world = createWorld();
  const registry = createRegistry();
  let fov;

  registerRule(registry, 'seeing-rule', 'TakeTurn', (action, ctx) => {
    fov = ctx.computeFov({ x: 0, y: 0 }, 2);
  });

  dispatchExclusive(world, registry, { type: 'TakeTurn' }, { isOpaque: () => false });

  assert.ok(fov.has('0,0'));
  assert.ok(fov.has('2,0'));
});

test('mapQuery threads through dispatchExclusive follow-ons into their own dispatch()', () => {
  const world = createWorld();
  const registry = createRegistry();
  let foundPath;

  registerRule(registry, 'decide', 'TakeTurn', () => ({
    followOn: [{ type: 'Check' }],
  }));
  registerRule(registry, 'check-path', 'Check', (action, ctx) => {
    foundPath = ctx.findPath({ x: 0, y: 0 }, { x: 1, y: 0 });
  });

  dispatchExclusive(world, registry, { type: 'TakeTurn' }, { isWalkable: () => true });

  assert.deepEqual(foundPath, [{ x: 1, y: 0 }]);
});

test('ctx.enqueueRenderEvent pushes onto the renderEvents queue passed into dispatch()', () => {
  const world = createWorld();
  const registry = createRegistry();
  const renderEvents = createRenderEventQueue();

  registerRule(registry, 'emits-render-event', 'Move', (action, ctx) => {
    ctx.enqueueRenderEvent({ kind: 'animation', entity: action.entity });
  });

  dispatch(world, registry, { type: 'Move', entity: 1 }, undefined, renderEvents);

  assert.equal(renderEvents.events.length, 1);
  assert.deepEqual(renderEvents.events[0], { kind: 'animation', entity: 1 });
});

test('ctx.enqueueRenderEvent is a no-op when no renderEvents queue is supplied', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerRule(registry, 'emits-render-event', 'Move', (action, ctx) => {
    ctx.enqueueRenderEvent({ kind: 'animation' });
  });

  assert.doesNotThrow(() => dispatch(world, registry, { type: 'Move' }));
});

test('ctx.addActor/removeActor thread through to the scheduler passed into dispatch()', () => {
  const world = createWorld();
  const registry = createRegistry();
  const scheduler = createScheduler(100);
  const entity = createEntity(world);

  registerRule(registry, 'schedules-a-timer', 'Move', (action, ctx) => {
    ctx.addActor(entity, -50);
  });

  dispatch(world, registry, { type: 'Move' }, undefined, undefined, scheduler);

  assert.equal(scheduler.actors.get(entity), -50);

  registerRule(registry, 'removes-a-timer', 'Check', (action, ctx) => {
    ctx.removeActor(entity);
  });
  dispatch(world, registry, { type: 'Check' }, undefined, undefined, scheduler);

  assert.equal(scheduler.actors.has(entity), false);
});

test('ctx.addActor is a no-op when no scheduler is supplied', () => {
  const world = createWorld();
  const registry = createRegistry();

  registerRule(registry, 'schedules-a-timer', 'Move', (action, ctx) => {
    ctx.addActor(1, -50);
  });

  assert.doesNotThrow(() => dispatch(world, registry, { type: 'Move' }));
});

test('renderEvents threads through dispatchExclusive follow-ons into their own dispatch()', () => {
  const world = createWorld();
  const registry = createRegistry();
  const renderEvents = createRenderEventQueue();

  registerRule(registry, 'decide', 'TakeTurn', () => ({
    followOn: [{ type: 'Check' }],
  }));
  registerRule(registry, 'check-emits', 'Check', (action, ctx) => {
    ctx.enqueueRenderEvent({ kind: 'sound' });
  });

  dispatchExclusive(world, registry, { type: 'TakeTurn' }, undefined, renderEvents);

  assert.equal(renderEvents.events.length, 1);
});

test('components filter: a rule with no filter always fires', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];

  registerRule(registry, 'always-fires', 'Move', (action) => {
    seen.push(action.entity);
  });

  dispatch(world, registry, { type: 'Move', entity: createEntity(world) });

  assert.equal(seen.length, 1);
});

test('components filter: a bare string entry is a presence-only check', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];
  const withFlag = createEntity(world);
  const without = createEntity(world);
  addComponent(world, withFlag, 'Flammable', {});

  registerRule(registry, 'needs-flammable', 'Ignite', (action) => {
    seen.push(action.entity);
  }, { components: { all: ['Flammable'] } });

  dispatch(world, registry, { type: 'Ignite', entity: withFlag });
  dispatch(world, registry, { type: 'Ignite', entity: without });

  assert.deepEqual(seen, [withFlag]);
});

test('components filter: an object entry checks presence plus field comparisons (partial match)', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];
  const goblinShaman = createEntity(world);
  const goblinGrunt = createEntity(world);
  addComponent(world, goblinShaman, 'EntityType', { type: 'Goblin' });
  addComponent(world, goblinShaman, 'Class', { role: 'Shaman', level: 3 });
  addComponent(world, goblinGrunt, 'EntityType', { type: 'Goblin' });
  addComponent(world, goblinGrunt, 'Class', { role: 'Grunt', level: 1 });

  registerRule(registry, 'cast-spell', 'TakeTurn', (action) => {
    seen.push(action.entity);
  }, {
    components: {
      all: [
        { component: 'EntityType', equals: { type: 'Goblin' } },
        { component: 'Class', equals: { role: 'Shaman' } },
      ],
    },
  });

  dispatch(world, registry, { type: 'TakeTurn', entity: goblinShaman });
  dispatch(world, registry, { type: 'TakeTurn', entity: goblinGrunt });

  // Extra unrelated field (level) on the matched component data doesn't
  // break the match - partial, not whole-object, equality.
  assert.deepEqual(seen, [goblinShaman]);
});

test('components filter: "any" matches when at least one entry matches (OR)', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];
  const mage = createEntity(world);
  const shaman = createEntity(world);
  const grunt = createEntity(world);
  addComponent(world, mage, 'Class', { role: 'Mage' });
  addComponent(world, shaman, 'Class', { role: 'Shaman' });
  addComponent(world, grunt, 'Class', { role: 'Grunt' });

  registerRule(registry, 'spellcasters', 'TakeTurn', (action) => {
    seen.push(action.entity);
  }, {
    components: {
      any: [
        { component: 'Class', equals: { role: 'Mage' } },
        { component: 'Class', equals: { role: 'Shaman' } },
      ],
    },
  });

  dispatch(world, registry, { type: 'TakeTurn', entity: mage });
  dispatch(world, registry, { type: 'TakeTurn', entity: shaman });
  dispatch(world, registry, { type: 'TakeTurn', entity: grunt });

  assert.deepEqual(seen, [mage, shaman]);
});

test('components filter: "none" excludes entities matching any of its entries', () => {
  const world = createWorld();
  const registry = createRegistry();
  const seen = [];
  const healthy = createEntity(world);
  const silenced = createEntity(world);
  addComponent(world, silenced, 'Status', { effect: 'Silenced' });

  registerRule(registry, 'can-cast', 'TakeTurn', (action) => {
    seen.push(action.entity);
  }, {
    components: {
      none: [{ component: 'Status', equals: { effect: 'Silenced' } }],
    },
  });

  dispatch(world, registry, { type: 'TakeTurn', entity: healthy });
  dispatch(world, registry, { type: 'TakeTurn', entity: silenced });

  assert.deepEqual(seen, [healthy]);
});

test('components filter: gt/gte/lt/lte/in/notIn operators compare a single field', () => {
  const world = createWorld();
  const registry = createRegistry();
  const low = createEntity(world);
  const high = createEntity(world);
  addComponent(world, low, 'Health', { current: 2 });
  addComponent(world, high, 'Health', { current: 9 });

  const seenGt = [];
  registerRule(registry, 'hurt-gt', 'Check', (action) => {
    seenGt.push(action.entity);
  }, { components: { all: [{ component: 'Health', lt: { current: 5 } }] } });

  dispatch(world, registry, { type: 'Check', entity: low });
  dispatch(world, registry, { type: 'Check', entity: high });

  assert.deepEqual(seenGt, [low]);

  const seenIn = [];
  registerRule(registry, 'in-check', 'CheckIn', (action) => {
    seenIn.push(action.entity);
  }, { components: { all: [{ component: 'Health', in: { current: [9] } }] } });

  dispatch(world, registry, { type: 'CheckIn', entity: low });
  dispatch(world, registry, { type: 'CheckIn', entity: high });

  assert.deepEqual(seenIn, [high]);
});

test('components filter: dispatchExclusive skips non-matching rules as non-candidates', () => {
  const world = createWorld();
  const registry = createRegistry();
  const shaman = createEntity(world);
  addComponent(world, shaman, 'Class', { role: 'Shaman' });

  registerRule(registry, 'cast', 'TakeTurn', () => ({
    followOn: [{ type: 'Cast' }],
  }), {
    priority: 100,
    components: { all: [{ component: 'Class', equals: { role: 'Mage' } }] },
  });
  registerRule(registry, 'wander', 'TakeTurn', () => ({
    followOn: [{ type: 'Wander' }],
  }), { priority: 1 });

  const result = dispatchExclusive(world, registry, { type: 'TakeTurn', entity: shaman });

  assert.deepEqual(
    result.resolved.map((a) => a.type),
    ['TakeTurn', 'Wander'],
  );
});
