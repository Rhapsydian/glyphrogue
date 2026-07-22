// registerScriptedEvent (scripting-api.md): declarative sugar for the
// multi-step case only - compiles a step list down to the EventState +
// rule mechanism the doc already named as the real primitive. Progress
// tracking lives on a dedicated tracking entity created lazily the first
// time an event's trigger matches (not the entity that triggered it) -
// resolved live with the user at session-25 checkpoint 2, since the
// triggering entity isn't guaranteed to be the same one involved in a
// later waitFor step (e.g. trigger is the player entering a region,
// waitFor is "all goblins defeated"). Tagging the tracking entity with a
// ScriptedEvent component (rather than a JS-side id->entity map) keeps
// this state inside the normal ECS world, so it saves/loads for free via
// the same DTO mechanism as everything else, per the doc's own claim.
//
// A trigger firing while an event is already tracked (in progress, not yet
// destroyed) is a no-op - re-entering a region mid-ambush doesn't restart
// it. Once an event's last step resolves, its tracking entity is destroyed;
// a later trigger match with no tracking entity alive starts a fresh
// instance. True "only ever once" semantics would need separate persistent
// bookkeeping the doc doesn't ask for - not built here.

import { register, get } from './registry.js';
import { registerRule } from './actions.js';

// Shared by the trigger and every waitFor step: field-equality against the
// condition object (minus its own `action`/`predicate` keys), ANDed with an
// optional predicate escape hatch for anything a field list can't express -
// the doc names both forms without saying how they combine when both are
// present, so both apply together rather than one overriding the other.
function matchesCondition(action, condition, ctx) {
  if (action.type !== condition.action) return false;

  for (const [key, value] of Object.entries(condition)) {
    if (key === 'action' || key === 'predicate') continue;
    if (action[key] !== value) return false;
  }

  if (condition.predicate && !condition.predicate(action, ctx)) return false;

  return true;
}

function findEventEntity(ctx, id) {
  return ctx.query(['ScriptedEvent']).find((entity) => ctx.getComponent(entity, 'ScriptedEvent').id === id);
}

// A timeUnits wait resolves through the same "wait for a specific action"
// mechanism as the plain action form (scripting-api.md) - it just schedules
// a Timer entity (engine.js's act() dispatches its carried action once the
// scheduler picks it, per the timer/scheduler-integration fork resolved
// live at checkpoint 3) that emits this synthetic action when it fires.
// Two distinct shapes for the same identifying fields: `timerAction` is a
// real dispatchable action (keyed `type`, like any other action), while
// `timerCondition` is a match condition for matchesCondition (keyed
// `action`, like `trigger`/`waitFor` throughout this module).
function timerAction(id, step) {
  return { type: 'EventTimerElapsed', eventId: id, step };
}

function timerCondition(id, step) {
  return { action: 'EventTimerElapsed', eventId: id, step };
}

// Runs every consecutive `do` step starting at fromIndex, stopping at the
// next `waitFor` step (recorded into EventState.step for that step's rule
// to pick up - a timeUnits step also gets its Timer entity scheduled here)
// or the end of the list (tracking entity destroyed - nothing left to
// advance).
function advance(ctx, entity, def, fromIndex, id) {
  const actions = [];
  let index = fromIndex;

  while (index < def.steps.length && def.steps[index].do) {
    actions.push(...def.steps[index].do);
    index += 1;
  }

  if (index >= def.steps.length) {
    ctx.destroyEntity(entity);
  } else {
    ctx.addComponent(entity, 'EventState', { step: index });

    const { timeUnits } = def.steps[index].waitFor;
    if (timeUnits !== undefined) {
      const timer = ctx.createEntity();
      ctx.addComponent(timer, 'Timer', { action: timerAction(id, index) });
      ctx.addActor(timer, -timeUnits);
    }
  }

  return actions.length > 0 ? { followOn: actions } : undefined;
}

export function registerScriptedEvent(registry, id, def, options) {
  register(registry, id, def, options);

  registerRule(registry, `${id}::trigger`, def.trigger.action, (action, ctx) => {
    if (!matchesCondition(action, def.trigger, ctx)) return;
    if (findEventEntity(ctx, id) !== undefined) return;

    const entity = ctx.createEntity();
    ctx.addComponent(entity, 'ScriptedEvent', { id });
    ctx.addComponent(entity, 'EventState', { step: 0 });

    return advance(ctx, entity, def, 0, id);
  });

  def.steps.forEach((step, index) => {
    if (!step.waitFor) return;

    const actionType = step.waitFor.action ?? 'EventTimerElapsed';
    const condition = step.waitFor.action ? step.waitFor : timerCondition(id, index);

    registerRule(registry, `${id}::step::${index}`, actionType, (action, ctx) => {
      if (!matchesCondition(action, condition, ctx)) return;

      const entity = findEventEntity(ctx, id);
      if (entity === undefined) return;
      if (ctx.getComponent(entity, 'EventState').step !== index) return;

      return advance(ctx, entity, def, index + 1, id);
    });
  });
}

export function getScriptedEvent(registry, id) {
  return get(registry, id);
}
