<script>
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

  $effect(() => {
    refresh();
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
</style>
