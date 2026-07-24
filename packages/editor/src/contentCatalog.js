import { createRecordingApi, loadPlugins } from '@glyphrogue/core';

// Content browser (editor.md): the static/registry view's data source.
// Mirrors pluginCatalog.js's checkPluginLoadErrors posture (run the real
// loadPlugins against a fake recording api, never a live world) but reads
// the manifest back instead of just checking for a throw. Takes the
// already-computed enabledPlugins array pluginCatalog.js's deriveCatalog
// produces, rather than re-deriving "what's enabled" from bootstrap
// discovery a second time.
// Plugins themselves are browsable too (editor.md's kind list ends "...
// scripted events, plugins)"), but registerRule/registerGenerator/etc.
// never say which plugin they came from - loadPlugins only resolves
// dependency order and calls register(api), it doesn't tag entries by
// origin. A synthetic 'plugin' entry per enabled plugin, appended after
// everything register() produced, is enough for the browser to list and
// search plugins by id/version without needing per-entry provenance.
export function deriveManifest(enabledPlugins) {
  const { manifest, api } = createRecordingApi();
  loadPlugins(api, enabledPlugins);

  for (const plugin of enabledPlugins) {
    manifest.push({ kind: 'plugin', id: plugin.id, version: plugin.version });
  }

  return manifest;
}

// A components filter entry (actions.js's matchesComponentEntry) is either
// a bare component-name string or { component, ...operators }.
function componentNameOf(entry) {
  return typeof entry === 'string' ? entry : entry.component;
}

// "Inspect a component, see its rules" (editor.md). Any rule mentioning a
// component in any of all/any/none counts as referencing it - field-level
// operators aren't evaluable without a live entity, so this only looks at
// which components are named, not what they're compared against.
export function componentIndex(manifest) {
  const index = {};

  for (const entry of manifest) {
    if (entry.kind !== 'rule' || !entry.components) continue;

    for (const bucket of ['all', 'any', 'none']) {
      for (const filterEntry of entry.components[bucket] ?? []) {
        const componentName = componentNameOf(filterEntry);
        (index[componentName] ??= []).push({ ruleId: entry.id, bucket });
      }
    }
  }

  return index;
}

// A static, name-only version of actions.js's matchesComponentFilter -
// field-level operators can't be evaluated against a declared component
// list (only against a live entity's actual data), so a filter entry
// referencing a component is treated as satisfied whenever that component
// name is present in the declared set. This means a rule with a field
// predicate can show as "would match" a type even when only some real
// instances actually satisfy the predicate - the live view is where that
// distinction becomes checkable, this index is a static approximation.
function ruleFilterCouldMatch(filter, declaredComponents) {
  if (!filter) return true;
  const { all = [], any = [], none = [] } = filter;
  const has = (entry) => declaredComponents.includes(componentNameOf(entry));

  if (!all.every(has)) return false;
  if (any.length > 0 && !any.some(has)) return false;
  if (none.some(has)) return false;

  return true;
}

// "Entity type -> every rule that would match its instances" (editor.md).
export function entityTypeRuleIndex(manifest) {
  const rules = manifest.filter((entry) => entry.kind === 'rule');
  const index = {};

  for (const entry of manifest) {
    if (entry.kind !== 'entityType') continue;

    index[entry.id] = rules
      .filter((rule) => ruleFilterCouldMatch(rule.components, entry.components ?? []))
      .map((rule) => rule.id);
  }

  return index;
}

// The registry view's single list-filtering function - kind-facet
// checkboxes, free-text id search, and the two cross-reference re-filter
// modes ("everything referencing this component/entity type") are all the
// same operation: narrow the flat manifest down to a subset. Per editor.md,
// the cross-reference modes are alternate entry points into this same list,
// not a separate view, so they live in this one function rather than a
// parallel lookup path.
export function filterManifest(
  manifest,
  { kinds, search, referencedComponent, referencedEntityType } = {},
) {
  let entries = manifest;

  if (referencedComponent) {
    const ruleIds = new Set(
      (componentIndex(manifest)[referencedComponent] ?? []).map((ref) => ref.ruleId),
    );
    return entries.filter((entry) => entry.kind === 'rule' && ruleIds.has(entry.id));
  }

  if (referencedEntityType) {
    const ruleIds = new Set(entityTypeRuleIndex(manifest)[referencedEntityType] ?? []);
    return entries.filter((entry) => entry.kind === 'rule' && ruleIds.has(entry.id));
  }

  if (kinds) {
    entries = entries.filter((entry) => kinds.includes(entry.kind));
  }

  if (search) {
    const needle = search.toLowerCase();
    entries = entries.filter((entry) => entry.id.toLowerCase().includes(needle));
  }

  return entries;
}
