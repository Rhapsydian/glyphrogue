// The editor's behavior wizard (docs/design/editor.md's "Composition
// wizard", roadmap item 8 - session 38's design conversation superseded
// the doc's original "never writes a file" prose; see the session log for
// the full reasoning). Dev-time-only matching/codegen logic, kept UI-free
// and unit-testable, same split every other editor tool's own *.js/*.svelte
// pair already follows. The actual runtime dispatch (applyRuleOverride)
// lives in @glyphrogue/core instead, since generated plugin files ship as
// part of a downstream game's own source and import it at real runtime -
// this module never runs there.
import { isEntityTypePinned } from '@glyphrogue/core';
import { isValidExportName } from './mapEditorExport.js';

export { isValidExportName };

export function pluginFilePath(id) {
  return `src/plugins/${id}/index.js`;
}

// Existing composition plugins - reuses the same /plugins/discover
// candidates+bootstrap response pluginCatalog.js's deriveCatalog already
// fetches (so App.svelte can derive both from one round trip), but scans
// for a `ruleOverrides` array export instead of classifying kind - a
// composition plugin is identified structurally by that export, not by
// anything pluginCatalog.js's own Content/Service classification tracks.
// `enabled` is computed the same way deriveCatalog does for an author
// candidate (bootstrap import + loadPlugins-array membership).
//
// Cache-busted (`?t=`) unlike deriveCatalog's own default importModule -
// composition plugins are the first candidates a session can realistically
// rewrite more than once (save -> edit -> save again), and the browser's
// native ES module cache serves the first-loaded module for a URL forever
// otherwise, regardless of Vite's own file-watching, since a fully dynamic
// runtime import() isn't one of Vite's statically-tracked/HMR-invalidated
// imports. Found live: a second save's emptied entries didn't show up
// until this fix.
export async function discoverCompositions(
  { candidates, bootstrap },
  { importModule = (url) => import(/* @vite-ignore */ `${url}?t=${Date.now()}`) } = {},
) {
  const compositions = [];

  for (const candidate of candidates) {
    const module = await importModule(candidate.url);
    if (!Array.isArray(module.ruleOverrides)) continue;

    const authorImport = bootstrap.authorImports.find((imp) => imp.sourcePath.includes(`plugins/${candidate.id}/`));
    const enabled = Boolean(authorImport && bootstrap.loadPluginsArrayEntries.includes(authorImport.localName));

    compositions.push({
      id: module.default?.id ?? candidate.id,
      entries: module.ruleOverrides,
      enabled,
      importName: authorImport?.localName,
    });
  }

  return compositions;
}

// pluginCatalog.js's catalog `content` array (extended in checkpoint 1 to
// carry components/actionType/dependencies for every discovered candidate,
// enabled or not) is the search space for both matchers below - a rule is
// only a real candidate here when it has an actionType (kind === 'content'
// also covers generators, which never do).
function isRuleEntry(entry) {
  return entry.kind === 'content' && Boolean(entry.actionType);
}

function componentNameOf(entry) {
  return typeof entry === 'string' ? entry : entry.component;
}

// "If I add component X to this entity, which existing rules start
// applying?" (editor.md) - only ever considers a rule's `all` bucket:
// `any` doesn't need every listed component added (just one, ambiguous
// which to suggest) and a `none` conflict can never be resolved by adding
// components (adding only grows the declared set). Entity-type-pinned
// rules are excluded entirely - they can never newly match a *different*
// type by adding components, since EntityType is set at instantiation, not
// author-editable per instance; those are widenableRules' job instead.
export function attachableBehaviors(entityComponentNames, content) {
  const results = [];

  for (const entry of content) {
    if (!isRuleEntry(entry)) continue;
    if (isEntityTypePinned(entry.components)) continue;

    const filter = entry.components ?? {};
    const noneConflict = (filter.none ?? []).some((f) => entityComponentNames.includes(componentNameOf(f)));
    if (noneConflict) continue;

    const anyEntries = filter.any ?? [];
    if (anyEntries.length > 0 && !anyEntries.some((f) => entityComponentNames.includes(componentNameOf(f)))) continue;

    const missingComponents = (filter.all ?? [])
      .map(componentNameOf)
      .filter((name) => !entityComponentNames.includes(name));
    if (missingComponents.length === 0) continue; // already applies - not attachable, already active

    results.push({ entry, missingComponents });
  }

  return results;
}

// Entity-type-pinned rules that don't yet cover `entityId` - the "widen"
// entry's candidate list. `nextTypes` is the full desired list an
// applied entry would store (not a delta), matching
// ruleOverrides.js's widenEntityTypeFilter contract.
export function widenableRules(entityId, content) {
  const results = [];

  for (const entry of content) {
    if (!isRuleEntry(entry)) continue;
    if (!isEntityTypePinned(entry.components)) continue;

    const currentTypes = entityTypesOf(entry.components);
    if (currentTypes.includes(entityId)) continue;

    results.push({ entry, currentTypes, nextTypes: [...currentTypes, entityId] });
  }

  return results;
}

function entityTypesOf(filter) {
  for (const bucket of ['all', 'any', 'none']) {
    for (const entry of filter?.[bucket] ?? []) {
      if (componentNameOf(entry) !== 'EntityType') continue;
      if (entry.equals) return [entry.equals.type];
      if (entry.in) return entry.in.type;
    }
  }
  return [];
}

// Delete is only ever offered when nothing would be lost or broken: the
// composition has no entries left, it's not currently loaded, and no other
// discovered candidate (enabled or not) declares it as a dependency.
export function canDeleteComposition({ id, entries, enabled }, allCandidates) {
  const reasons = [];

  if (entries.length > 0) reasons.push('composition is not empty');
  if (enabled) reasons.push('composition is still enabled');

  const dependents = allCandidates.filter(
    (candidate) => candidate.id !== id && Object.keys(candidate.dependencies ?? {}).includes(id),
  );
  if (dependents.length > 0) reasons.push(`depended on by: ${dependents.map((d) => d.id).join(', ')}`);

  return { ok: reasons.length === 0, reasons };
}

// Composition plugins (create/update - both are just "write this text"):
// entries are plain data, safe to regenerate blindly any time the author
// adds/removes/edits one. dependencies deliberately stays core-only, not
// auto-derived from entries' targets - a target isn't guaranteed to come
// from a plugin at all (e.g. a bootstrap file registering an entity type
// directly, outside loadPlugins entirely), so there's no reliable id to
// point at. The author adds one by hand in the generated file if their
// composition genuinely needs to load after a specific plugin.
export function generateCompositionSource({ id, entries, version = '1.0.0' }) {
  return [
    "// Generated by the editor's behavior wizard - entries are plain data,",
    '// safe to regenerate any time you add/remove/edit one via the wizard.',
    '// Add plugin ids to dependencies by hand if a target must load after a',
    '// specific plugin - not auto-derived (a target may not come from a',
    '// plugin at all, e.g. a bootstrap-registered entity type).',
    "import { applyRuleOverride, CORE_API_VERSION } from '@glyphrogue/core';",
    '',
    `export const ruleOverrides = ${JSON.stringify(entries, null, 2)};`,
    '',
    'export default {',
    `  id: ${JSON.stringify(id)},`,
    `  version: ${JSON.stringify(version)},`,
    '  dependencies: { core: `^${CORE_API_VERSION}` },',
    '  register(api) {',
    '    for (const entry of ruleOverrides) applyRuleOverride(api, entry);',
    '  },',
    '};',
    '',
  ].join('\n');
}

// Custom scaffold (one-shot only - the wizard never regenerates or
// revisits this file again once written, unlike composition plugins, since
// its handler body is hand-written the moment the author starts filling in
// the TODO). `components` is the filter the wizard's UI already resolved
// for whichever scope the author picked (entity-type-scoped: an
// EntityType.equals filter; standalone: a marker-component filter) - kept
// as a plain parameter here rather than re-deriving the scope choice, same
// "caller passes the fully-resolved shape" posture generateComposedSource
// takes for its own steps.
export function generateCustomRuleSource({ pluginId, ruleId, actionType, components }) {
  return [
    "// Scaffolded once by the editor's behavior wizard - a starting point,",
    '// not tool-owned: fill in the TODO and edit freely from here on, same',
    '// as any other hand-authored plugin. The wizard never regenerates or',
    '// revisits this file again.',
    "import { CORE_API_VERSION } from '@glyphrogue/core';",
    '',
    'export default {',
    `  id: ${JSON.stringify(pluginId)},`,
    "  version: '1.0.0',",
    '  dependencies: { core: `^${CORE_API_VERSION}` },',
    '  register(api) {',
    `    api.registerRule(${JSON.stringify(ruleId)}, ${JSON.stringify(actionType)}, (action, ctx) => {`,
    '      // TODO: implement this rule.',
    `    }, { components: ${JSON.stringify(components)} });`,
    '  },',
    '};',
    '',
  ].join('\n');
}
