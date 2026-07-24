import { CORE_PLUGINS, createRecordingApi, loadPlugins } from '@glyphrogue/core';
import * as core from '@glyphrogue/core';

// Browser-safe (no `node:` imports) - combines /plugins/discover's
// server-parsed data with the one browser-safe operation that has to
// happen here: dynamically importing a candidate module and running its
// register() against recordingApi.js's fake api to see what it actually
// registers (editor.md/scripting-api.md - kind is only observable this
// way, no plugin object carries a static `kind` field). Core-bundled
// plugins don't need a dynamic import at all - CORE_PLUGINS already holds
// the real objects, imported statically like any other @glyphrogue/core
// export.

// A Content plugin registers exactly one thing today (one registerRule /
// registerGenerator call each); a Service plugin's one registerService
// call is the same shape. Manifest's first entry is enough to classify -
// revisit if a future plugin ever registers more than one kind at once.
function deriveManifestEntry(plugin) {
  const { manifest, api } = createRecordingApi();
  plugin.register(api);
  const [first] = manifest;
  return { kind: first?.kind === 'service' ? 'service' : 'content' };
}

// The imported identifier a bootstrap file uses for a core-bundled plugin
// is the export's own name (e.g. `bspPlugin`), not `plugin.id` (`'bsp'`) -
// derived by finding which key of the `@glyphrogue/core` namespace this
// exact object came from, rather than hand-maintaining a second id->name
// map alongside corePlugins.js's CORE_PLUGINS list.
function exportNameFor(plugin) {
  return Object.entries(core).find(([, value]) => value === plugin)?.[0];
}

function addToServices(services, slotId, source, entry) {
  services[slotId] = { ...services[slotId], [source]: entry };
}

// A never-yet-imported plugin still needs a name to suggest in its
// "add this import" instruction. Core plugins have one real answer
// (`exportNameFor`, above); an author-authored candidate has no fixed
// export name (it's a default export) so this camelCase-plus-`Plugin`
// guess, matching this project's existing id-naming convention, is the
// best a tool can offer as a starting point.
function suggestedImportName(id) {
  return `${id.replace(/-([a-z0-9])/gi, (_, char) => char.toUpperCase())}Plugin`;
}

// `importModule` defaults to a real dynamic import (only meaningful in a
// browser served by Vite - a candidate's `url` is a site-absolute path,
// not a filesystem path) but is injectable so this stays unit-testable
// under node:test without a live dev server.
export async function deriveCatalog(
  { candidates, bootstrap },
  { importModule = (url) => import(/* @vite-ignore */ url) } = {},
) {
  const content = [];
  const services = {};
  const enabledPlugins = [];

  for (const plugin of CORE_PLUGINS) {
    const exportName = exportNameFor(plugin);
    const alreadyImported = Boolean(exportName && bootstrap.coreImportNames.includes(exportName));
    const enabled = alreadyImported && bootstrap.loadPluginsArrayEntries.includes(exportName);
    const { kind } = deriveManifestEntry(plugin);
    const entry = {
      id: plugin.id,
      version: plugin.version,
      source: 'core',
      kind,
      enabled,
      // Only set when the bootstrap already imports it under this name -
      // buildToggleInstruction relies on `importName` being absent to
      // decide whether an import line is still needed, same contract as
      // an author entry's importName below. `suggestedImportName` is the
      // real export name regardless of import state, since core plugins
      // (unlike author ones) have one true correct answer.
      importName: alreadyImported ? exportName : undefined,
      suggestedImportName: exportName,
    };

    if (enabled) enabledPlugins.push(plugin);
    if (kind === 'service') addToServices(services, plugin.id, 'core', entry);
    else content.push(entry);
  }

  for (const candidate of candidates) {
    const module = await importModule(candidate.url);
    const plugin = module.default;
    if (!plugin) continue;

    const authorImport = bootstrap.authorImports.find((imp) => imp.sourcePath.includes(`plugins/${candidate.id}/`));
    const enabled = Boolean(authorImport && bootstrap.loadPluginsArrayEntries.includes(authorImport.localName));
    const { kind } = deriveManifestEntry(plugin);
    const entry = {
      id: plugin.id,
      version: plugin.version,
      source: 'author',
      kind,
      enabled,
      url: candidate.url,
      importName: authorImport?.localName,
      suggestedImportName: authorImport?.localName ?? suggestedImportName(plugin.id),
    };

    if (enabled) enabledPlugins.push(plugin);
    if (kind === 'service') addToServices(services, plugin.id, 'author', entry);
    else content.push(entry);
  }

  return { content, services, enabledPlugins };
}

// A dry run of the real loadPlugins (editor.md: "plugins.js's existing
// dependency-cycle/version-mismatch errors surface as UI feedback here
// instead of a console throw") - against recordingApi, never a live world,
// same "run register() against a fake api" posture as kind derivation
// above. Returns the error message, or null when the currently-enabled set
// loads cleanly.
export function checkPluginLoadErrors(enabledPlugins) {
  try {
    loadPlugins(createRecordingApi().api, enabledPlugins);
    return null;
  } catch (error) {
    return error.message;
  }
}

// Toggling/switching never writes the bootstrap file directly (editor.md:
// "surface a one-line instruction rather than silently rewrite a file the
// tool doesn't fully own", same pattern scaffold generation uses). Reuses
// `entry.importName` when the bootstrap already imports this plugin under
// some name; otherwise suggests one. The author-authored import path is a
// starting-point guess (`./src/plugins/<id>/index.js`, assuming a
// project-root bootstrap file) - the author adjusts it if their bootstrap
// lives elsewhere, same "hand-authored, not tool-owned" posture as every
// other bootstrap-touching suggestion in editor.md.
export function buildToggleInstruction(entry, nextEnabled) {
  const importName = entry.importName ?? entry.suggestedImportName;
  const lines = [];

  if (nextEnabled && !entry.importName) {
    lines.push(
      entry.source === 'core'
        ? `import { ${importName} } from '@glyphrogue/core';`
        : `import ${importName} from './src/plugins/${entry.id}/index.js';`,
    );
  }

  lines.push(
    nextEnabled
      ? `// add ${importName} to the loadPlugins(api, [...]) array`
      : `// remove ${importName} from the loadPlugins(api, [...]) array`,
  );

  return lines.join('\n');
}

// Services are single-slot (editor.md's "Services" section: "a per-slot
// selector, not a toggle list") - switching means enabling the chosen
// implementation and, if a different one was previously active, disabling
// it too. `nextEntry` of `null` is the "— none —" option: the slot simply
// stops being filled.
export function buildServiceSwitchInstruction(currentEntry, nextEntry) {
  const lines = [];
  if (nextEntry) lines.push(buildToggleInstruction(nextEntry, true));
  if (currentEntry && (!nextEntry || currentEntry.source !== nextEntry.source || currentEntry.id !== nextEntry.id)) {
    lines.push(buildToggleInstruction(currentEntry, false));
  }
  return lines.join('\n');
}
