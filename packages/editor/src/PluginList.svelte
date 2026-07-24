<script>
  // `entries` is the combined two-source Content list from
  // pluginCatalog.js's deriveCatalog (editor.md: core-bundled and
  // author-authored plugins render as one list, staying visually
  // distinguishable by source). `onToggle(entry)` is owned by the parent -
  // toggling never writes anything itself, it surfaces a copy-ready
  // instruction (see App.svelte's shared instruction banner). `onRefresh`
  // re-runs discovery after a successful import/export changes what's on
  // disk - import/export themselves are handled locally here since they're
  // not shared with PluginServices.
  let { entries, onToggle, onRefresh } = $props();

  let importPath = $state('');
  let ioStatus = $state(null);

  async function postJson(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function doImport() {
    if (!importPath.trim()) return;
    const result = await postJson('/__glyphrogue_editor/plugins/import', { sourcePath: importPath.trim() });
    if (result.ok) {
      ioStatus = { kind: 'ok', message: `Imported "${result.id}" into src/plugins/.` };
      importPath = '';
      await onRefresh();
    } else {
      ioStatus = { kind: 'error', message: result.error };
    }
  }

  async function doExport(entry) {
    const destinationPath = window.prompt(`Export "${entry.id}" to which folder?`);
    if (!destinationPath) return;
    const result = await postJson('/__glyphrogue_editor/plugins/export', { pluginId: entry.id, destinationPath });
    ioStatus = result.ok
      ? { kind: 'ok', message: `Exported "${entry.id}" to ${result.path}.` }
      : { kind: 'error', message: result.error };
  }
</script>

<section class="plugin-list">
  <div class="header">
    <h3>Content</h3>
    <div class="import">
      <input type="text" placeholder="Path to a received plugin folder…" bind:value={importPath} />
      <button onclick={doImport}>Import…</button>
    </div>
  </div>

  {#if ioStatus}
    <p class={ioStatus.kind === 'error' ? 'error' : 'ok'}>{ioStatus.message}</p>
  {/if}

  {#if entries.length === 0}
    <p class="empty">No content plugins discovered.</p>
  {:else}
    <ul>
      {#each entries as entry (entry.source + ':' + entry.id)}
        <li>
          <span class="dot" class:on={entry.enabled}>{entry.enabled ? '●' : '○'}</span>
          <span class="id">{entry.id}</span>
          <span class="source">{entry.source}</span>
          <button onclick={() => onToggle(entry)}>{entry.enabled ? 'Disable' : 'Enable'}</button>
          {#if entry.source === 'author'}
            <button onclick={() => doExport(entry)}>Export</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .plugin-list {
    margin-top: 1rem;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.9rem;
  }

  .import {
    display: flex;
    gap: 0.35rem;
  }

  .import input {
    font-family: inherit;
    font-size: 0.85rem;
    width: 22ch;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }

  .empty {
    color: #888;
  }

  .error {
    color: #e06666;
  }

  .ok {
    color: #6ab0ff;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.15rem 0;
  }

  .dot {
    color: #555;
    min-width: 1ch;
  }

  .dot.on {
    color: #6ab0ff;
  }

  .id {
    min-width: 14ch;
  }

  .source {
    min-width: 6ch;
    color: #888;
  }

  button {
    font-family: inherit;
    font-size: 0.85rem;
  }
</style>
