import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

test('a goblin-wanders-and-player-acts scenario driven entirely through createApi()', () => {
  const api = createApi({ roundBudget: 100 });

  const goblin = api.createEntity();
  api.addActor(goblin, 250);

  const player = api.createEntity();
  api.addComponent(player, 'PlayerControlled', {});
  api.addActor(player, 10);

  api.registerRule('wanders', 'TakeTurn', (action) => ({
    followOn: [{ type: 'Move', entity: action.entity, cost: 100 }],
  }));

  const turns = api.run();

  assert.ok(turns.length >= 1);
  assert.equal(turns[turns.length - 1].entity, player);
  assert.equal(turns[turns.length - 1].waiting, true);
  assert.equal(api.isLocked(), true);

  const result = api.resolvePlayerAction(player, { type: 'Move', entity: player, cost: 5 });
  assert.deepEqual(result.resolved.map((a) => a.type), ['Move']);
  assert.equal(api.isLocked(), false);
});

test('platform.unlockAchievement defaults to a harmless no-op', () => {
  const api = createApi();
  assert.doesNotThrow(() => api.platform.unlockAchievement('first-blood'));
});

test('an injected platform implementation is called with the right id', () => {
  const unlocked = [];
  const api = createApi({ platform: { unlockAchievement: (id) => unlocked.push(id) } });

  api.platform.unlockAchievement('first-blood');

  assert.deepEqual(unlocked, ['first-blood']);
});

test('two createApi({ seed }) instances produce the identical rng sequence', () => {
  const a = createApi({ seed: 1 });
  const b = createApi({ seed: 1 });

  const sequenceA = Array.from({ length: 5 }, () => a.rng.next());
  const sequenceB = Array.from({ length: 5 }, () => b.rng.next());

  assert.deepEqual(sequenceA, sequenceB);
});

test('different seeds produce different rng sequences', () => {
  const a = createApi({ seed: 1 });
  const b = createApi({ seed: 2 });

  assert.notEqual(a.rng.next(), b.rng.next());
});

test('generateZone defaults worldSeed to the api-level seed', () => {
  const a = createApi({ seed: 7 });
  a.registerGenerator('flat', (ctx) => ({ rngSample: ctx.rng.next() }));
  const b = createApi({ seed: 7 });
  b.registerGenerator('flat', (ctx) => ({ rngSample: ctx.rng.next() }));

  const zoneA = a.generateZone({ generatorId: 'flat', zoneId: 'z1' });
  const zoneB = b.generateZone({ generatorId: 'flat', zoneId: 'z1' });

  assert.equal(zoneA.rngSample, zoneB.rngSample);
});

test('generateZone accepts an explicit worldSeed override', () => {
  const api = createApi({ seed: 7 });
  api.registerGenerator('flat', (ctx) => ({ rngSample: ctx.rng.next() }));

  const withDefault = api.generateZone({ generatorId: 'flat', zoneId: 'z1' });
  const withOverride = api.generateZone({ generatorId: 'flat', zoneId: 'z1', worldSeed: 999 });

  assert.notEqual(withDefault.rngSample, withOverride.rngSample);
});

test('a registered TakeTurn rule can call ctx.findPath end-to-end via api.act()', () => {
  const isWalkable = (x, y) => x >= 0 && x < 5 && y >= 0 && y < 5;
  const api = createApi({ isWalkable });

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 0, y: 0 });
  api.addActor(goblin, 100);

  const player = api.createEntity();
  api.addComponent(player, 'Position', { x: 2, y: 0 });
  api.addComponent(player, 'PlayerControlled', {});
  api.addActor(player, 10);

  let followOn;
  api.registerRule('chase', 'TakeTurn', (action, ctx) => {
    const from = ctx.getComponent(action.entity, 'Position');
    const path = ctx.findPath(from, { x: 2, y: 0 });
    followOn = { type: 'Move', entity: action.entity, to: path[0], cost: 100 };
    return { followOn: [followOn] };
  });

  api.run();

  assert.deepEqual(followOn.to, { x: 1, y: 0 });
});

test('a registered TakeTurn rule can call ctx.computeFov end-to-end via api.act()', () => {
  const api = createApi({ isOpaque: () => false });

  const goblin = api.createEntity();
  api.addComponent(goblin, 'Position', { x: 0, y: 0 });
  api.addActor(goblin, 100);

  let sawOrigin;
  api.registerRule('perceive', 'TakeTurn', (action, ctx) => {
    const from = ctx.getComponent(action.entity, 'Position');
    const fov = ctx.computeFov(from, 3);
    sawOrigin = fov.has('0,0');
  });

  api.act();

  assert.equal(sawOrigin, true);
});

test('api.findPath and api.computeFov use the same injected map query outside any rule', () => {
  const api = createApi({
    isWalkable: (x, y) => x >= 0 && x < 5,
    isOpaque: () => false,
  });

  const path = api.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
  assert.deepEqual(path, [{ x: 1, y: 0 }, { x: 2, y: 0 }]);

  const fov = api.computeFov({ x: 0, y: 0 }, 2);
  assert.ok(fov.has('0,0'));
});

test('loadZone defaults worldSeed to the api-level seed and reapplies the diff', () => {
  const api = createApi({ seed: 7 });
  api.registerGenerator('flat', () => ({ width: 1, height: 1, cells: ['wall'], entities: [], anchors: [], logicalLinks: [] }));

  const zone = api.loadZone({
    generatorId: 'flat',
    zoneId: 'z1',
    diff: { cellOverrides: [{ x: 0, y: 0, cell: 'floor' }] },
  });

  assert.deepEqual(zone.cells, ['floor']);
});
