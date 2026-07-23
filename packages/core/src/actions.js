import { register, get, getOrderedIds } from './registry.js';
import {
  hasComponent,
  getComponent,
  addComponent,
  removeComponent,
  createEntity,
  destroyEntity,
  query,
} from './world.js';
import { findPath } from './pathfinding.js';
import { computeFov } from './fov.js';
import { enqueueRenderEvent } from './renderEvents.js';
import { soundsFor } from './sound.js';
import { addActor, removeActor } from './scheduler.js';

export function registerRule(registry, id, actionType, ruleFn, options = {}) {
  const { priority = 0, components, reads, writes, ...registryOptions } = options;
  register(registry, id, { actionType, ruleFn, priority, components, reads, writes }, registryOptions);
}

function pipelineFor(registry, actionType) {
  return getOrderedIds(registry)
    .map((id) => ({ id, ...get(registry, id) }))
    .filter((entry) => entry.actionType === actionType);
}

// editor.md's "components" filter: entity-gating enforced at dispatch time,
// replacing hand-rolled ctx.hasComponent/ctx.getComponent guards inside
// rule bodies. A string entry is presence-only; an object entry
// ({ component, ...operators }) is presence plus partial-match field
// comparisons - not whole-object equality, so extra unrelated fields on the
// component data never break a match. Every operator's value is itself
// { field: value } (or { field: [values] } for in/notIn). This is
// deliberately not a full nested boolean expression language - all/any/none
// combine with implicit AND between buckets, any is OR internally, none is
// exclusion; register the same rule twice for an OR-of-AND shape.
const FIELD_OPERATORS = {
  equals: (data, field, value) => data?.[field] === value,
  notEquals: (data, field, value) => data?.[field] !== value,
  gt: (data, field, value) => data?.[field] > value,
  gte: (data, field, value) => data?.[field] >= value,
  lt: (data, field, value) => data?.[field] < value,
  lte: (data, field, value) => data?.[field] <= value,
  in: (data, field, values) => values.includes(data?.[field]),
  notIn: (data, field, values) => !values.includes(data?.[field]),
};

function matchesComponentEntry(world, entity, entry) {
  const componentType = typeof entry === 'string' ? entry : entry.component;
  if (!hasComponent(world, entity, componentType)) return false;
  if (typeof entry === 'string') return true;

  const data = getComponent(world, entity, componentType);
  return Object.entries(entry)
    .filter(([key]) => key !== 'component')
    .every(([operator, fields]) => {
      const matchField = FIELD_OPERATORS[operator];
      if (!matchField) {
        throw new Error(`unknown component filter operator "${operator}"`);
      }
      return Object.entries(fields).every(([field, value]) => matchField(data, field, value));
    });
}

function matchesComponentFilter(world, entity, filter) {
  if (!filter) return true;
  const { all = [], any = [], none = [] } = filter;

  if (!all.every((entry) => matchesComponentEntry(world, entity, entry))) return false;
  if (any.length > 0 && !any.some((entry) => matchesComponentEntry(world, entity, entry))) return false;
  if (none.some((entry) => matchesComponentEntry(world, entity, entry))) return false;

  return true;
}

function resolvePriority(entry, action, ctx) {
  return typeof entry.priority === 'function' ? entry.priority(action, ctx) : entry.priority;
}

// editor.md's reads/writes enforcement: opt-in per rule (an entry
// declaring neither reads nor writes is never wrapped), dev-mode only -
// piggybacks on ordinary play-testing under the editor's harness rather
// than static analysis or a synthetic dry-run, zero cost when devMode is
// off. Wraps only getComponent/addComponent, since those are the two
// operations reads/writes actually govern.
function wrapCtxForRule(ctx, entry) {
  if (!entry.reads && !entry.writes) return ctx;

  const reads = entry.reads ?? [];
  const writes = entry.writes ?? [];

  return {
    ...ctx,
    getComponent: (entity, type) => {
      if (!reads.includes(type)) {
        throw new Error(`rule "${entry.id}" read undeclared component "${type}" (declare it in options.reads)`);
      }
      return ctx.getComponent(entity, type);
    },
    addComponent: (entity, type, data) => {
      if (!writes.includes(type)) {
        throw new Error(`rule "${entry.id}" wrote undeclared component "${type}" (declare it in options.writes)`);
      }
      return ctx.addComponent(entity, type, data);
    },
  };
}

// audio.md: "core's rule-resolution machinery pushes entries onto this
// buffer regardless of consumer" - automatic on every resolved action, not
// an opt-in step a consumer calls separately. One shared render-event
// queue, same as rendering's sequencing needs.
function emitSounds(registry, action, ctx, renderEvents) {
  if (!renderEvents) return;
  for (const { id, entry } of soundsFor(registry, action.type)) {
    if (entry.match && !entry.match(action, ctx)) continue;
    enqueueRenderEvent(renderEvents, { kind: 'sound', soundId: id, source: entry.source });
  }
}

// `mapQuery` (`{ isWalkable, isOpaque }`) is caller-injected at
// createApi() time, same DI shape as `platform`/`storage`/`rng` - core
// still owns no grid/zone storage (mapgen-and-editor.md), so ctx.findPath/
// ctx.computeFov just close over whatever query the game supplied. Either
// callback may be omitted if a rule pipeline never needs it. `renderEvents`
// (the render-event queue, renderEvents.js) is optional the same way -
// omitted, ctx.enqueueRenderEvent is a no-op, so existing calls/tests that
// predate rendering keep working unchanged. `scheduler` is a further
// optional trailing param, same precedent - omitted, ctx.addActor/
// removeActor are no-ops. Needed so a rule (e.g. registerScriptedEvent's
// compiled timeUnits wait) can schedule a Timer entity from inside dispatch.
function createContext(world, mapQuery = {}, renderEvents, scheduler) {
  return {
    hasComponent: (entity, type) => hasComponent(world, entity, type),
    getComponent: (entity, type) => getComponent(world, entity, type),
    addComponent: (entity, type, data) => addComponent(world, entity, type, data),
    removeComponent: (entity, type) => removeComponent(world, entity, type),
    createEntity: () => createEntity(world),
    destroyEntity: (entity) => destroyEntity(world, entity),
    query: (types) => query(world, types),
    findPath: (from, to, opts) => findPath(from, to, { ...opts, isWalkable: mapQuery.isWalkable }),
    computeFov: (origin, radius, opts) => computeFov(origin, radius, { ...opts, isOpaque: mapQuery.isOpaque }),
    enqueueRenderEvent: (event) => {
      if (renderEvents) enqueueRenderEvent(renderEvents, event);
    },
    addActor: (entity, initialBudget) => {
      if (scheduler) addActor(scheduler, entity, initialBudget);
    },
    removeActor: (entity) => {
      if (scheduler) removeActor(scheduler, entity);
    },
  };
}

export function dispatch(world, registry, action, mapQuery, renderEvents, scheduler, devMode = false) {
  const resolved = [];
  const vetoed = [];
  const queue = [action];
  const ctx = createContext(world, mapQuery, renderEvents, scheduler);

  while (queue.length > 0) {
    const current = queue.shift();
    const pipeline = pipelineFor(registry, current.type);

    let isVetoed = false;
    const followOns = [];

    for (const entry of pipeline) {
      if (!matchesComponentFilter(world, current.entity, entry.components)) continue;
      const ruleCtx = devMode ? wrapCtxForRule(ctx, entry) : ctx;
      const result = entry.ruleFn(current, ruleCtx);
      if (!result) continue;
      if (result.veto) {
        isVetoed = true;
        break;
      }
      if (result.followOn) {
        followOns.push(...result.followOn);
      }
    }

    if (isVetoed) {
      vetoed.push(current);
      continue;
    }

    resolved.push(current);
    emitSounds(registry, current, ctx, renderEvents);
    queue.push(...followOns);
  }

  return { resolved, vetoed };
}

// Exclusive resolution: unlike dispatch(), where every matching rule's
// effect applies, only the single highest-priority applicable rule's
// result is used - the rest are discarded candidates, never applied.
// Ties keep the earlier-registered (load-order) rule. This is for action
// types representing a mutually-exclusive choice (TakeTurn: an actor
// can't both Flee and Guard the same turn), not the additive-reaction
// shape most action types use.
export function dispatchExclusive(world, registry, action, mapQuery, renderEvents, scheduler, devMode = false) {
  const ctx = createContext(world, mapQuery, renderEvents, scheduler);
  const pipeline = pipelineFor(registry, action.type);

  let winnerResult;
  let winnerPriority = -Infinity;

  for (const entry of pipeline) {
    if (!matchesComponentFilter(world, action.entity, entry.components)) continue;
    const ruleCtx = devMode ? wrapCtxForRule(ctx, entry) : ctx;
    const result = entry.ruleFn(action, ruleCtx);
    if (!result) continue;

    const priority = resolvePriority(entry, action, ctx);
    if (priority > winnerPriority) {
      winnerPriority = priority;
      winnerResult = result;
    }
  }

  const resolved = [action];
  const vetoed = [];
  emitSounds(registry, action, ctx, renderEvents);

  for (const followOnAction of winnerResult?.followOn ?? []) {
    const sub = dispatch(world, registry, followOnAction, mapQuery, renderEvents, scheduler, devMode);
    resolved.push(...sub.resolved);
    vetoed.push(...sub.vetoed);
  }

  return { resolved, vetoed };
}
