// Recording api (scripting-api.md): a manifest is *derived*, never
// hand-authored - dev tooling (an editor's content browser, a load-time
// validator) calls a mod's register(api) against this recording
// implementation instead of a real one, logging each call rather than
// mutating any world/registry state, then reads the manifest back from
// what was logged. Mirrors only the register* surface - the declarative
// calls a manifest actually describes - not the full public api (act,
// dispatch, findPath, etc. have nothing meaningful to record and aren't
// expected to be called during registration).
//
// Flat list in call order, not grouped by kind: simpler to produce (one
// generic record() call per method instead of per-kind bucketing) and
// preserves true registration order, which a pre-grouped structure would
// lose. A consumer that wants "all rules" groups by `kind` itself.
export function createRecordingApi() {
  const manifest = [];

  function record(kind, id, extra = {}) {
    manifest.push({ kind, id, ...extra });
  }

  return {
    manifest,
    api: {
      registerEntity: (id, def = {}) => {
        record('entity', id, { components: Object.keys(def.components ?? {}) });
      },
      registerEntityType: (id, def = {}) => {
        record('entityType', id, {
          components: Object.keys(def.components ?? {}),
          rules: (def.rules ?? []).map((rule) => rule.action),
        });
      },
      registerRule: (id, actionType) => {
        record('rule', id, { actionType });
      },
      registerGenerator: (id) => {
        record('generator', id);
      },
      registerScreen: (id) => {
        record('screen', id);
      },
      registerSound: (id, def = {}) => {
        record('sound', id, { trigger: def.trigger });
      },
      registerScriptedEvent: (id, def = {}) => {
        record('scriptedEvent', id, {
          trigger: def.trigger?.action,
          steps: def.steps?.length ?? 0,
        });
      },
    },
  };
}
