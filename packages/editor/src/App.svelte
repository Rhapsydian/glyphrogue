<script>
  import PluginList from './PluginList.svelte';
  import PluginServices from './PluginServices.svelte';
  import MapEditor from './MapEditor.svelte';
  import CompositionTool from './CompositionTool.svelte';
  import ContentBrowser from './ContentBrowser.svelte';
  import {
    deriveCatalog,
    buildToggleInstruction,
    buildServiceSwitchInstruction,
    checkPluginLoadErrors,
  } from './pluginCatalog.js';
  import { createGlyphMetrics, createPalette, createFontSourceRegistry, registerFontSource } from '@glyphrogue/core';

  // Shared preview config (docs/design/editor.md: "Shared live-preview
  // rendering primitive") - real config for the map editor now, not
  // throwaway scaffolding. wall/floor/player/accent are the tokens
  // zoneRender.js's default tileset resolves against.
  const previewMetrics = createGlyphMetrics({ pixelsPerEm: 24 });
  const previewPalette = createPalette({
    wall: '#555555',
    floor: '#222222',
    player: '#6ab0ff',
    accent: '#e0a030',
  });
  const previewFontSources = createFontSourceRegistry();
  registerFontSource(previewFontSources, 'base', { unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: {} });

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
  let enabledPlugins = $state([]);

  async function refreshPlugins() {
    pluginLoading = true;
    try {
      const res = await fetch('/__glyphrogue_editor/plugins/discover');
      const discovery = await res.json();
      const catalog = await deriveCatalog(discovery);
      pluginContent = catalog.content;
      pluginServices = catalog.services;
      enabledPlugins = catalog.enabledPlugins;
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

  // Centralizes the file-write API's fetch call in App.svelte, same
  // convention refresh()/refreshPlugins() already follow - MapEditor (and
  // any later tool) stays a controlled component reporting writes upward
  // via this callback rather than calling fetch itself.
  async function writeFile(path, content, meta) {
    try {
      const res = await fetch('/__glyphrogue_editor/write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, content, ...meta }),
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // The generator composition tool's overwrite-confirmation gate
  // (editor.md: "loud, never silent") - devServerPlugin.js's /exists
  // middleware has been there since session 29, just never had a client
  // caller until this tool.
  async function checkExists(path) {
    try {
      const res = await fetch(`/__glyphrogue_editor/exists?path=${encodeURIComponent(path)}`);
      return await res.json();
    } catch (e) {
      return { exists: false, error: e.message };
    }
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
    <h2>Map editor</h2>
  </div>
  <MapEditor
    {api}
    metrics={previewMetrics}
    fontFamily="monospace"
    palette={previewPalette}
    fontSources={previewFontSources}
    onExport={writeFile}
  />

  <div class="header">
    <h2>Generator composition</h2>
  </div>
  <CompositionTool
    metrics={previewMetrics}
    fontFamily="monospace"
    palette={previewPalette}
    fontSources={previewFontSources}
    onExport={writeFile}
    onCheckExists={checkExists}
  />

  <div class="header">
    <h2>Content browser</h2>
  </div>
  <ContentBrowser {api} {enabledPlugins} />
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

</style>
