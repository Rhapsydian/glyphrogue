// The narrow shared form primitive's pure schema-derivation logic
// (docs/design/editor.md: "Narrow shared form primitive") - scoped to
// exactly the flat { key: defaultValue } shape shared by generator
// paramsDefaults and audio mixing settings. Control type is inferred
// purely from each default's JS type - no min/max/enum metadata layer,
// matching the same "values only, no schema" posture paramsDefaults
// itself takes (mapgen.js). Kept separate from NarrowForm.svelte so it
// stays unit-testable under node:test without a Svelte/DOM harness, same
// split devServerPlugin.js/pluginCatalog.js already use for their own
// parse/validate logic.

export function inferFieldType(value) {
  return typeof value;
}

export function buildFieldSpecs(defaults) {
  return Object.entries(defaults).map(([key, defaultValue]) => ({
    key,
    type: inferFieldType(defaultValue),
    defaultValue,
  }));
}
