import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_PLUGINS } from '@glyphrogue/core';
import {
  deriveCatalog,
  buildToggleInstruction,
  buildServiceSwitchInstruction,
  checkPluginLoadErrors,
} from '../src/pluginCatalog.js';

const emptyBootstrap = { coreImportNames: [], authorImports: [], loadPluginsArrayEntries: [] };

function discoverResponse(overrides = {}) {
  return { candidates: [], bootstrap: emptyBootstrap, ...overrides };
}

test('deriveCatalog splits the ten core-bundled plugins into 8 content + 2 services, all disabled by default', async () => {
  const { content, services } = await deriveCatalog(discoverResponse());

  assert.equal(content.length, 8);
  assert.ok(content.every((entry) => entry.source === 'core' && entry.kind === 'content' && entry.enabled === false));

  assert.deepEqual(Object.keys(services).sort(), ['audioLoader', 'memory']);
  assert.equal(services.memory.core.enabled, false);
  assert.equal(services.audioLoader.core.enabled, false);
});

test('deriveCatalog marks a core plugin enabled only when both imported and listed in loadPlugins', async () => {
  const bootstrap = {
    coreImportNames: ['bspPlugin'],
    authorImports: [],
    loadPluginsArrayEntries: ['bspPlugin'],
  };
  const { content } = await deriveCatalog(discoverResponse({ bootstrap }));

  const bsp = content.find((entry) => entry.id === 'bsp');
  assert.equal(bsp.enabled, true);
  assert.ok(content.filter((entry) => entry.id !== 'bsp').every((entry) => entry.enabled === false));
});

test('deriveCatalog does not enable a core plugin that is imported but missing from the loadPlugins array', async () => {
  const bootstrap = { coreImportNames: ['bspPlugin'], authorImports: [], loadPluginsArrayEntries: [] };
  const { content } = await deriveCatalog(discoverResponse({ bootstrap }));

  assert.equal(content.find((entry) => entry.id === 'bsp').enabled, false);
});

test('deriveCatalog includes a service entry under services.memory.core with the core export name', async () => {
  const { services } = await deriveCatalog(discoverResponse());
  assert.equal(services.memory.core.id, 'memory');
  assert.equal(services.memory.core.source, 'core');
  // Not yet imported by this empty bootstrap - importName stays unset,
  // but the real export name is still known as a suggestion.
  assert.equal(services.memory.core.importName, undefined);
  assert.equal(services.memory.core.suggestedImportName, 'memoryPlugin');
});

test('deriveCatalog discovers an author-authored content plugin via the injected importer', async () => {
  const fakePlugin = {
    id: 'goblin-ai',
    version: '1.0.0',
    dependencies: {},
    register: (api) => api.registerGenerator('goblin-ai'),
  };
  const bootstrap = {
    coreImportNames: [],
    authorImports: [{ localName: 'goblinPlugin', sourcePath: './plugins/goblin-ai/index.js' }],
    loadPluginsArrayEntries: ['goblinPlugin'],
  };
  const candidates = [{ id: 'goblin-ai', url: '/dev/sandbox/src/plugins/goblin-ai/index.js' }];

  const { content } = await deriveCatalog(discoverResponse({ candidates, bootstrap }), {
    importModule: async (url) => {
      assert.equal(url, '/dev/sandbox/src/plugins/goblin-ai/index.js');
      return { default: fakePlugin };
    },
  });

  const author = content.find((entry) => entry.source === 'author');
  assert.deepEqual(
    { id: author.id, kind: author.kind, enabled: author.enabled, importName: author.importName },
    { id: 'goblin-ai', kind: 'content', enabled: true, importName: 'goblinPlugin' },
  );
});

test('deriveCatalog discovers an author-authored service override under services.<slot>.author', async () => {
  const fakeServicePlugin = {
    id: 'memory',
    version: '1.0.0',
    dependencies: {},
    override: 'memory',
    register: (api) => api.registerService('memory'),
  };
  const candidates = [{ id: 'my-memory', url: '/dev/sandbox/src/plugins/my-memory/index.js' }];
  const bootstrap = {
    coreImportNames: [],
    authorImports: [{ localName: 'myMemoryPlugin', sourcePath: './plugins/my-memory/index.js' }],
    loadPluginsArrayEntries: [],
  };

  const { services } = await deriveCatalog(discoverResponse({ candidates, bootstrap }), {
    importModule: async () => ({ default: fakeServicePlugin }),
  });

  assert.equal(services.memory.author.source, 'author');
  assert.equal(services.memory.author.enabled, false);
});

test('deriveCatalog skips a candidate module with no default export', async () => {
  const candidates = [{ id: 'broken', url: '/dev/sandbox/src/plugins/broken/index.js' }];
  const { content, services } = await deriveCatalog(discoverResponse({ candidates }), {
    importModule: async () => ({}),
  });

  assert.equal(content.filter((entry) => entry.source === 'author').length, 0);
  assert.ok(Object.values(services).every((slot) => !slot.author));
});

test('deriveCatalog + buildToggleInstruction end to end: a never-imported core plugin still gets a real import line', async () => {
  // Exercises the real pipeline rather than a hand-built entry - catches
  // the class of bug where a catalog entry's importName reflects the
  // plugin's true export name even when it isn't actually imported yet.
  const { content } = await deriveCatalog(discoverResponse());
  const bsp = content.find((entry) => entry.id === 'bsp');

  assert.equal(bsp.importName, undefined);
  assert.equal(
    buildToggleInstruction(bsp, true),
    `import { bspPlugin } from '@glyphrogue/core';\n// add bspPlugin to the loadPlugins(api, [...]) array`,
  );
});

test('buildToggleInstruction for enabling a not-yet-imported core plugin includes the import line', () => {
  const entry = { id: 'bsp', source: 'core', importName: undefined, suggestedImportName: 'bspPlugin' };
  assert.equal(
    buildToggleInstruction(entry, true),
    `import { bspPlugin } from '@glyphrogue/core';\n// add bspPlugin to the loadPlugins(api, [...]) array`,
  );
});

test('buildToggleInstruction for enabling an already-imported plugin skips the import line', () => {
  const entry = { id: 'bsp', source: 'core', importName: 'bspPlugin', suggestedImportName: 'bspPlugin' };
  assert.equal(buildToggleInstruction(entry, true), '// add bspPlugin to the loadPlugins(api, [...]) array');
});

test('buildToggleInstruction for disabling never suggests removing the import, only the array entry', () => {
  const entry = { id: 'bsp', source: 'core', importName: 'bspPlugin', suggestedImportName: 'bspPlugin' };
  assert.equal(buildToggleInstruction(entry, false), '// remove bspPlugin from the loadPlugins(api, [...]) array');
});

test('buildToggleInstruction for an unimported author plugin suggests a camelCase name and relative path', () => {
  const entry = {
    id: 'goblin-ai',
    source: 'author',
    importName: undefined,
    suggestedImportName: 'goblinAiPlugin',
  };
  assert.equal(
    buildToggleInstruction(entry, true),
    `import goblinAiPlugin from './src/plugins/goblin-ai/index.js';\n// add goblinAiPlugin to the loadPlugins(api, [...]) array`,
  );
});

test('buildServiceSwitchInstruction switching from none to core just enables the new filler', () => {
  const next = { id: 'memory', source: 'core', importName: 'memoryPlugin', suggestedImportName: 'memoryPlugin' };
  assert.equal(buildServiceSwitchInstruction(null, next), '// add memoryPlugin to the loadPlugins(api, [...]) array');
});

test('buildServiceSwitchInstruction switching between two implementations enables the new one and disables the old', () => {
  const current = { id: 'memory', source: 'core', importName: 'memoryPlugin', suggestedImportName: 'memoryPlugin' };
  const next = {
    id: 'memory',
    source: 'author',
    importName: 'myMemoryPlugin',
    suggestedImportName: 'myMemoryPlugin',
  };
  assert.equal(
    buildServiceSwitchInstruction(current, next),
    [
      '// add myMemoryPlugin to the loadPlugins(api, [...]) array',
      '// remove memoryPlugin from the loadPlugins(api, [...]) array',
    ].join('\n'),
  );
});

test('buildServiceSwitchInstruction switching to "none" only disables the current filler', () => {
  const current = { id: 'memory', source: 'core', importName: 'memoryPlugin', suggestedImportName: 'memoryPlugin' };
  assert.equal(
    buildServiceSwitchInstruction(current, null),
    '// remove memoryPlugin from the loadPlugins(api, [...]) array',
  );
});

test('buildServiceSwitchInstruction is a no-op description when switching to the currently active filler', () => {
  const current = { id: 'memory', source: 'core', importName: 'memoryPlugin', suggestedImportName: 'memoryPlugin' };
  assert.equal(
    buildServiceSwitchInstruction(current, current),
    '// add memoryPlugin to the loadPlugins(api, [...]) array',
  );
});

test('deriveCatalog collects both core and author enabled plugin objects into enabledPlugins', async () => {
  const fakePlugin = {
    id: 'goblin-ai',
    version: '1.0.0',
    dependencies: {},
    register: (api) => api.registerGenerator('goblin-ai'),
  };
  const bootstrap = {
    coreImportNames: ['bspPlugin'],
    authorImports: [{ localName: 'goblinPlugin', sourcePath: './plugins/goblin-ai/index.js' }],
    loadPluginsArrayEntries: ['bspPlugin', 'goblinPlugin'],
  };
  const candidates = [{ id: 'goblin-ai', url: '/dev/sandbox/src/plugins/goblin-ai/index.js' }];

  const { enabledPlugins } = await deriveCatalog(discoverResponse({ candidates, bootstrap }), {
    importModule: async () => ({ default: fakePlugin }),
  });

  assert.equal(enabledPlugins.length, 2);
  assert.ok(enabledPlugins.some((plugin) => plugin.id === 'bsp'));
  assert.ok(enabledPlugins.includes(fakePlugin));
});

test('deriveCatalog excludes disabled plugins from enabledPlugins', async () => {
  const { enabledPlugins } = await deriveCatalog(discoverResponse());
  assert.deepEqual(enabledPlugins, []);
});

test('checkPluginLoadErrors returns null for an empty enabled set', () => {
  assert.equal(checkPluginLoadErrors([]), null);
});

test('checkPluginLoadErrors returns null when the real core-bundled plugins load together cleanly', () => {
  assert.equal(checkPluginLoadErrors(CORE_PLUGINS), null);
});

test('checkPluginLoadErrors surfaces a missing-dependency error from a dry run, never touching a real world', () => {
  const plugin = {
    id: 'goblin-ai',
    version: '1.0.0',
    dependencies: { 'some-other-plugin': '^1.0.0' },
    register: (api) => api.registerRule('goblin-ai', 'TakeTurn'),
  };
  assert.match(checkPluginLoadErrors([plugin]), /"goblin-ai" depends on "some-other-plugin", which is not registered/);
});

test('checkPluginLoadErrors surfaces a core-version-mismatch error', () => {
  const plugin = {
    id: 'goblin-ai',
    version: '1.0.0',
    dependencies: { core: '^99.0.0' },
    register: (api) => api.registerRule('goblin-ai', 'TakeTurn'),
  };
  assert.match(checkPluginLoadErrors([plugin]), /requires core \^99\.0\.0/);
});
