// Runtime support for the editor's behavior wizard (docs/design/editor.md's
// "Composition wizard", roadmap item 8 - session 38 design conversation
// superseded the doc's original "never writes a file" prose). A generated
// composition plugin's register(api) is data-driven: it walks a plain
// `ruleOverrides` array and calls applyRuleOverride(api, entry) for each -
// this module is that shared dispatcher, plus the filter-shape helpers it
// needs. Lives in packages/core (not packages/editor) because generated
// plugin files ship as part of a downstream game's own source and import
// this at real runtime - packages/editor is dev-time-only tooling that
// never ships.
//
// A rule is "entity-type-pinned" when its components filter references the
// synthetic EntityType component every instantiated entity carries
// (definitions.js's instantiateEntity) - registerEntityType's inline rules
// sugar always produces this shape, but nothing stops a standalone
// registerRule call from using it directly. Detecting it is just checking
// whether any filter entry names that one component.

function componentNameOf(entry) {
  return typeof entry === 'string' ? entry : entry.component;
}

export function isEntityTypePinned(filter) {
  if (!filter) return false;
  return ['all', 'any', 'none'].some((bucket) => (filter[bucket] ?? []).some((entry) => componentNameOf(entry) === 'EntityType'));
}

// The type id(s) a type-pinned filter currently covers - equals resolves to
// a single-item list, in resolves to its declared list, so both shapes give
// widenEntityTypeFilter's caller a uniform starting point to add to.
export function entityTypesOfFilter(filter) {
  for (const bucket of ['all', 'any', 'none']) {
    for (const entry of filter?.[bucket] ?? []) {
      if (componentNameOf(entry) !== 'EntityType') continue;
      if (entry.equals) return [entry.equals.type];
      if (entry.in) return entry.in.type;
    }
  }
  return [];
}

// Replaces whichever filter entry names EntityType with an `in` operator
// covering the full desired `types` list, preserving every other entry in
// every bucket untouched. If the filter somehow has no EntityType entry yet
// (shouldn't happen for a genuinely type-pinned rule, but not assumed), one
// is added to `all`.
export function widenEntityTypeFilter(filter, types) {
  const next = {};
  let replaced = false;

  for (const bucket of ['all', 'any', 'none']) {
    const entries = filter?.[bucket];
    if (!entries) continue;
    next[bucket] = entries.map((entry) => {
      if (componentNameOf(entry) !== 'EntityType') return entry;
      replaced = true;
      return { component: 'EntityType', in: { type: types } };
    });
  }

  if (!replaced) {
    next.all = [...(next.all ?? []), { component: 'EntityType', in: { type: types } }];
  }

  return next;
}

// The two entry kinds a generated composition plugin's ruleOverrides array
// can contain - both read the live-registered value back via api's
// getEntityDefinition/getRule before re-registering with options.override,
// so neither needs to know or reconstruct anything about wherever the
// original definition/rule was declared.
export function applyRuleOverride(api, entry) {
  if (entry.kind === 'attach-component') {
    const def = api.getEntityDefinition(entry.entityId);
    api.registerEntity(
      entry.entityId,
      { components: { ...def.components, [entry.component]: entry.data } },
      { override: entry.entityId },
    );
    return;
  }

  if (entry.kind === 'widen-rule-types') {
    const existing = api.getRule(entry.ruleId);
    api.registerRule(entry.ruleId, existing.actionType, existing.ruleFn, {
      ...existing,
      components: widenEntityTypeFilter(existing.components, entry.types),
      override: entry.ruleId,
    });
    return;
  }

  throw new Error(`applyRuleOverride: unknown entry kind "${entry.kind}"`);
}
