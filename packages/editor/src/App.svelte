<script>
  import PluginList from './PluginList.svelte';
  import PluginServices from './PluginServices.svelte';
  import LivePreview from './LivePreview.svelte';
  import NarrowForm from './NarrowForm.svelte';
  import {
    deriveCatalog,
    buildToggleInstruction,
    buildServiceSwitchInstruction,
    checkPluginLoadErrors,
  } from './pluginCatalog.js';
  import {
    createGlyphMetrics,
    createPalette,
    createFontSourceRegistry,
    registerFontSource,
    createTileset,
    registerSymbol,
    resolveSymbol,
    get as getRegistryEntry,
  } from '@glyphrogue/core';

  // Checkpoint-4 demo scaffolding (docs/design/editor.md: "Shared UI
  // infrastructure") - throwaway verification fixtures for LivePreview
  // exercising its three real consumer shapes (a 1x1 swatch, a single
  // assembled tile, a small terrain grid standing in for a calibration
  // grid / scratch zone) since no real consumer (map editor, tileset
  // editor, config UI - roadmap items 5-9) exists yet to verify against.
  // Expected to be superseded once those land.
  const demoMetrics = createGlyphMetrics({ pixelsPerEm: 24 });
  const demoPalette = createPalette({
    wall: '#555555',
    floor: '#222222',
    player: '#6ab0ff',
    accent: '#e0a030',
  });
  const demoFontSources = createFontSourceRegistry();
  registerFontSource(demoFontSources, 'base', { unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: {} });
  const demoTileset = createTileset();
  registerSymbol(demoTileset, 'player', { fontFace: 'base', codepoint: '40', foreground: { token: 'player' } });
  const playerTile = resolveSymbol(demoTileset, demoFontSources, demoMetrics, 'player');

  const swatchCommands = [{ col: 0, row: 0, text: ' ', color: 'transparent', background: { token: 'accent' } }];
  const tileCommands = [{ col: 0, row: 0, ...playerTile, background: { token: 'floor' } }];

  const miniZoneRows = ['######', '#....#', '#.@..#', '######'];
  const miniZoneCommands = miniZoneRows.flatMap((line, row) =>
    [...line].map((ch, col) => {
      if (ch === '#') return { col, row, text: ' ', color: 'transparent', background: { token: 'wall' } };
      if (ch === '@') return { col, row, ...playerTile, background: { token: 'floor' } };
      return { col, row, text: ' ', color: 'transparent', background: { token: 'floor' } };
    }),
  );

  // Checkpoint-4 demo scaffolding, continued - NarrowForm's two real
  // consumers: generator paramsDefaults (derived live from the registry,
  // not hand-copied, per the "derive-don't-hand-maintain" posture) and
  // audio mixing's flat { master, music, sfx } shape (audioSettings.js;
  // no persisted settings source exists yet, so these are plain literal
  // defaults, same as any game author would write directly).
  const bspDefaults = getRegistryEntry(api.registry, 'bsp')?.paramsDefaults ?? {};
  const audioDefaults = { master: 1, music: 0.7, sfx: 0.7 };
  let bspValues = $state({ ...bspDefaults });
  let audioValues = $state({ ...audioDefaults });

  // `api` isn't needed by the touched-files log itself (purely
  // server-derived git+provenance state) but stays accepted here since
  // every later roadmap tool (map editor, content browser, ...) mounts
  // inside this same root and does need it.
  let { api } = $props();

  let touchedFiles = $state([]);
  let error = $state(null);
  let loading = $state(false);

  async function refresh() {
    loading = true;
    try {
      const res = await fetch('/__glyphrogue_editor/touched-files');
      const body = await res.json();
      touchedFiles = body.touchedFiles ?? [];
      error = body.error ?? null;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  let pluginContent = $state([]);
  let pluginServices = $state({});
  let pluginError = $state(null);
  let pluginLoading = $state(false);
  let instruction = $state(null);
  let loadError = $state(null);

  async function refreshPlugins() {
    pluginLoading = true;
    try {
      const res = await fetch('/__glyphrogue_editor/plugins/discover');
      const discovery = await res.json();
      const catalog = await deriveCatalog(discovery);
      pluginContent = catalog.content;
      pluginServices = catalog.services;
      pluginError = null;
      // Dry-run only, against a fake api - never mutates anything (editor.md:
      // dependency-cycle/version-mismatch errors surface here instead of only
      // a console throw the author would otherwise never see in this tool).
      loadError = checkPluginLoadErrors(catalog.enabledPlugins);
    } catch (e) {
      pluginError = e.message;
    } finally {
      pluginLoading = false;
    }
  }

  function togglePlugin(entry) {
    instruction = buildToggleInstruction(entry, !entry.enabled);
  }

  function switchService(currentEntry, nextEntry) {
    instruction = buildServiceSwitchInstruction(currentEntry, nextEntry);
  }

  $effect(() => {
    refresh();
    refreshPlugins();
  });
</script>

<div class="glyphrogue-editor">
  <div class="header">
    <h2>Touched files</h2>
    <button onclick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if touchedFiles.length === 0}
    <p class="empty">No touched files yet.</p>
  {:else}
    <ul>
      {#each touchedFiles as file (file.path)}
        <li>
          <code class="status">{file.status}</code>
          <span class="path">{file.path}</span>
          {#if file.label}<span class="label">— {file.label}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="header">
    <h2>Plugins</h2>
    <button onclick={refreshPlugins} disabled={pluginLoading}>
      {pluginLoading ? 'Refreshing…' : 'Refresh'}
    </button>
  </div>

  {#if pluginError}
    <p class="error">{pluginError}</p>
  {/if}

  {#if loadError}
    <div class="load-error">
      <strong>Plugin load error</strong>
      <p>✕ {loadError}</p>
    </div>
  {/if}

  <PluginList entries={pluginContent} onToggle={togglePlugin} onRefresh={refreshPlugins} />
  <PluginServices services={pluginServices} onSwitch={switchService} />

  {#if instruction}
    <div class="instruction">
      <pre>{instruction}</pre>
      <div class="instruction-actions">
        <button onclick={() => navigator.clipboard.writeText(instruction)}>Copy</button>
        <button onclick={() => (instruction = null)}>Dismiss</button>
      </div>
    </div>
  {/if}

  <div class="header">
    <h2>Live preview primitive demo</h2>
  </div>
  <div class="preview-row">
    <div class="preview-item">
      <span class="preview-label">swatch</span>
      <LivePreview commands={swatchCommands} cols={1} rows={1} metrics={demoMetrics} fontFamily="monospace" palette={demoPalette} />
    </div>
    <div class="preview-item">
      <span class="preview-label">assembled tile</span>
      <LivePreview commands={tileCommands} cols={1} rows={1} metrics={demoMetrics} fontFamily="monospace" palette={demoPalette} />
    </div>
    <div class="preview-item">
      <span class="preview-label">mini zone</span>
      <LivePreview commands={miniZoneCommands} cols={6} rows={4} metrics={demoMetrics} fontFamily="monospace" palette={demoPalette} />
    </div>
  </div>

  <div class="header">
    <h2>Narrow form primitive demo</h2>
  </div>
  <div class="form-row">
    <div class="form-item">
      <h3>BSP generator params</h3>
      <NarrowForm
        defaults={bspDefaults}
        values={bspValues}
        onChange={(key, value) => (bspValues = { ...bspValues, [key]: value })}
      />
    </div>
    <div class="form-item">
      <h3>Audio mix</h3>
      <NarrowForm
        defaults={audioDefaults}
        values={audioValues}
        onChange={(key, value) => (audioValues = { ...audioValues, [key]: value })}
      />
    </div>
  </div>
</div>

<style>
  .glyphrogue-editor {
    font-family: monospace;
    padding: 1rem;
    background: #1e1e1e;
    color: #ddd;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  .empty {
    color: #888;
  }

  .error {
    color: #e06666;
  }

  ul {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
  }

  li {
    padding: 0.15rem 0;
  }

  .status {
    display: inline-block;
    min-width: 2ch;
    color: #6ab0ff;
  }

  .label {
    color: #888;
  }

  .load-error {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #2b1a1a;
    border: 1px solid #e06666;
  }

  .load-error strong {
    display: block;
    font-size: 0.85rem;
  }

  .load-error p {
    margin: 0.25rem 0 0;
    color: #e06666;
  }

  .instruction {
    margin-top: 0.75rem;
    padding: 0.5rem;
    background: #262626;
    border: 1px solid #444;
  }

  .instruction pre {
    margin: 0 0 0.4rem;
    white-space: pre-wrap;
    color: #ddd;
  }

  .instruction-actions {
    display: flex;
    gap: 0.5rem;
  }

  .preview-row {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .preview-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .preview-label {
    color: #888;
    font-size: 0.85rem;
  }

  .form-row {
    display: flex;
    gap: 2rem;
    margin-top: 0.5rem;
  }

  .form-item h3 {
    margin: 0 0 0.35rem;
    font-size: 0.9rem;
  }
</style>
