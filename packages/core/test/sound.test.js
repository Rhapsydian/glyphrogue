import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

test('a registered sound fires exactly one render event when its trigger action resolves', () => {
  const api = createApi({ roundBudget: 100 });
  const player = api.createEntity();
  api.addActor(player, 10);

  api.registerSound('clang', { trigger: 'Attack', source: 'assets/clang.ogg' });
  api.registerRule('attack-noop', 'Attack', () => {});

  api.resolvePlayerAction(player, { type: 'Attack', entity: player, cost: 0 });

  assert.deepEqual(api.renderEvents.events, [{ kind: 'sound', soundId: 'clang', source: 'assets/clang.ogg' }]);
});

test('match narrows which resolved actions emit a sound', () => {
  const api = createApi({ roundBudget: 100 });
  const undead = api.createEntity();
  api.addComponent(undead, 'Undead', {});
  const living = api.createEntity();
  api.addActor(undead, 10);
  api.addActor(living, 10);

  api.registerSound('death-rattle', {
    trigger: 'Death',
    source: 'assets/rattle.ogg',
    match: (action, ctx) => ctx.hasComponent(action.entity, 'Undead'),
  });
  api.registerRule('death-noop', 'Death', () => {});

  api.resolvePlayerAction(undead, { type: 'Death', entity: undead, cost: 0 });
  api.resolvePlayerAction(living, { type: 'Death', entity: living, cost: 0 });

  assert.equal(api.renderEvents.events.length, 1);
  assert.equal(api.renderEvents.events[0].soundId, 'death-rattle');
});

test('an unmatched trigger action type emits nothing', () => {
  const api = createApi({ roundBudget: 100 });
  const player = api.createEntity();
  api.addActor(player, 10);

  api.registerSound('footstep', { trigger: 'Move', source: 'assets/step.ogg' });
  api.registerRule('attack-noop', 'Attack', () => {});

  api.resolvePlayerAction(player, { type: 'Attack', entity: player, cost: 0 });

  assert.deepEqual(api.renderEvents.events, []);
});

test('dispatchExclusive (TakeTurn) emits sounds for its top-level action too', () => {
  const api = createApi({ roundBudget: 100 });
  const goblin = api.createEntity();
  api.addActor(goblin, 100);

  api.registerSound('turn-tick', { trigger: 'TakeTurn', source: 'assets/tick.ogg' });
  api.registerRule('idle', 'TakeTurn', () => {});

  api.act();

  assert.deepEqual(api.renderEvents.events, [{ kind: 'sound', soundId: 'turn-tick', source: 'assets/tick.ogg' }]);
});
