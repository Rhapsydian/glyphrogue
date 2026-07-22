// Mod module format + dependency-ordered loading (scripting-api.md): a mod
// is a single default export shaped { id, version, dependencies, register }.
// Load order reuses registry.js's existing generic topological sort
// (createRegistry/register/getOrderedIds) applied to mod ids, rather than
// writing a second sort - the same reuse precedent that motivated building
// getOrderedIds generically in the first place (session 15). `core` is
// deliberately excluded from the dependency graph itself (it isn't
// "loaded" the way a mod is) and checked separately via satisfiesRange
// against the declared core range.
//
// Missing dependency and dependency-cycle errors come straight from
// getOrderedIds. Version-incompatibility (core or mod-to-mod) is also a
// hard load-time error here, matching this doc's broader posture of
// resolving every ambiguous-state question as an explicit error rather
// than a best-effort fallback.

import { createRegistry, register, get, getOrderedIds } from './registry.js';

// This project's plugin-API version (scripting-api.md's "independent of
// the save schema" version number) - bumped whenever register()'s surface
// changes in a way mods should be able to check compatibility against.
export const CORE_API_VERSION = '0.1.0';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version) {
  const match = SEMVER_RE.exec(version);
  if (!match) {
    throw new Error(`"${version}" is not a valid major.minor.patch version`);
  }
  return match.slice(1, 4).map(Number);
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Hand-rolled subset of semver range syntax: ^ (compatible within the same
// major, or same minor/patch once major is 0, per npm's caret rules), ~
// (compatible within the same minor), or an exact version. No pre-release
// tags, no range combinators (`1.x || 2.x`) - resolved live with the user
// as this project's first version-range comparator: narrower than the
// full semver spec in exchange for staying at zero runtime dependencies.
export function satisfiesRange(version, range) {
  const actual = parseVersion(version);

  if (range.startsWith('^')) {
    const wanted = parseVersion(range.slice(1));
    if (compareVersions(actual, wanted) < 0) return false;
    if (wanted[0] > 0) return actual[0] === wanted[0];
    if (wanted[1] > 0) return actual[0] === 0 && actual[1] === wanted[1];
    return actual[0] === 0 && actual[1] === 0 && actual[2] === wanted[2];
  }

  if (range.startsWith('~')) {
    const wanted = parseVersion(range.slice(1));
    return actual[0] === wanted[0] && actual[1] === wanted[1] && compareVersions(actual, wanted) >= 0;
  }

  return compareVersions(actual, parseVersion(range)) === 0;
}

// Registers every mod's descriptor into its own dependency-graph registry
// (id-namespaced separately from the main content registry - mod ids and
// content ids are different namespaces), resolves load order, checks
// version compatibility, then calls register(api) on each mod in order.
// Returns the resolved load order (mod ids).
export function loadMods(api, mods, { coreApiVersion = CORE_API_VERSION } = {}) {
  const modRegistry = createRegistry();

  for (const mod of mods) {
    const dependsOn = Object.keys(mod.dependencies ?? {}).filter((depId) => depId !== 'core');
    register(modRegistry, mod.id, mod, { dependsOn });
  }

  const order = getOrderedIds(modRegistry);

  for (const id of order) {
    const mod = get(modRegistry, id);

    for (const [depId, range] of Object.entries(mod.dependencies ?? {})) {
      if (depId === 'core') {
        if (!satisfiesRange(coreApiVersion, range)) {
          throw new Error(`mod "${id}" requires core ${range}, but core is ${coreApiVersion}`);
        }
        continue;
      }

      const dependency = get(modRegistry, depId);
      if (!satisfiesRange(dependency.version, range)) {
        throw new Error(`mod "${id}" requires "${depId}" ${range}, but "${depId}" is ${dependency.version}`);
      }
    }

    mod.register(api);
  }

  return order;
}
