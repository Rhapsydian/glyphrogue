<script>
  // Config UI (docs/design/editor.md: "Config UI") - three tabs (Palette /
  // Keybindings / Audio), each tuning a different underlying mechanism but
  // all writing the tuned result to project source via the shared
  // file-write API rather than depending on dev-time local storage.
  // Palette lands this checkpoint; Keybindings/Audio are stubbed until
  // their own checkpoints. A flat single-file screen with an internal tab
  // switcher, same precedent TilesetEditor.svelte set for a multi-tab tool.
  import LivePreview from './LivePreview.svelte';
  import { createPalette } from '@glyphrogue/core';
  import {
    buildPaletteRows,
    swatchCommand,
    renamePaletteToken,
    setPaletteToken,
    removePaletteToken,
    serializePaletteTokens,
    palettePath,
    setGradientDirection,
    setGradientStopOffset,
    setGradientStopColor,
    addGradientStop,
    removeGradientStop,
    isStopTokenRef,
  } from './configPalette.js';

  let { palette, metrics, fontFamily, onExport, onCheckExists } = $props();

  let activeTab = $state('palette');

  // Own editable copy, seeded once from the incoming palette - the same
  // "tune it live, then write the result to project source" posture
  // editor.md's Config UI section describes; the passed-in palette prop
  // stays whatever the dev fixture (or a real game's own bootstrap) wired
  // up, untouched until an explicit Save.
  let tokens = $state({ ...palette.tokens });
  let livePalette = $derived(createPalette(tokens));
  let rows = $derived(buildPaletteRows(tokens));

  let newTokenName = $state('');

  function handleRename(previousName, nextName) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === previousName || trimmed in tokens) return;
    tokens = renamePaletteToken(tokens, previousName, trimmed);
  }

  function handleColorChange(name, value) {
    tokens = setPaletteToken(tokens, name, value);
  }

  function handleRemoveToken(name) {
    tokens = removePaletteToken(tokens, name);
  }

  function handleAddToken() {
    const name = newTokenName.trim();
    if (!name || name in tokens) return;
    tokens = setPaletteToken(tokens, name, '#ffffff');
    newTokenName = '';
  }

  function handleDirectionChange(name, direction) {
    tokens = setPaletteToken(tokens, name, setGradientDirection(tokens[name], direction));
  }

  function handleStopOffsetChange(name, index, offset) {
    tokens = setPaletteToken(tokens, name, setGradientStopOffset(tokens[name], index, offset));
  }

  function handleStopColorChange(name, index, color) {
    tokens = setPaletteToken(tokens, name, setGradientStopColor(tokens[name], index, color));
  }

  function handleAddStop(name) {
    tokens = setPaletteToken(tokens, name, addGradientStop(tokens[name]));
  }

  function handleRemoveStop(name, index) {
    tokens = setPaletteToken(tokens, name, removeGradientStop(tokens[name], index));
  }

  function toggleStopKind(name, index, currentColor) {
    const nextColor = isStopTokenRef(currentColor) ? '#ffffff' : { token: Object.keys(tokens).find((key) => key !== name) ?? name };
    handleStopColorChange(name, index, nextColor);
  }

  // Write/exists/overwrite-confirm - same "loud, never silent" pattern
  // MapEditor.svelte/CompositionTool.svelte established.
  let destinationPath = $state(palettePath());
  let saveStatus = $state(null); // null | 'checking' | 'confirm-overwrite' | 'pending' | { ok, error? }

  async function writePalette() {
    saveStatus = 'pending';
    saveStatus = await onExport(destinationPath, serializePaletteTokens(tokens), {
      tool: 'config-ui',
      label: 'palette',
    });
  }

  async function handleSave() {
    saveStatus = 'checking';
    const { exists } = await onCheckExists(destinationPath);
    if (exists) {
      saveStatus = 'confirm-overwrite';
      return;
    }
    await writePalette();
  }

  function cancelOverwrite() {
    saveStatus = null;
  }
</script>

<div class="config-ui">
  <div class="tabs">
    <button class:active={activeTab === 'palette'} onclick={() => (activeTab = 'palette')}>Palette</button>
    <button class:active={activeTab === 'keybindings'} onclick={() => (activeTab = 'keybindings')}>Keybindings</button>
    <button class:active={activeTab === 'audio'} onclick={() => (activeTab = 'audio')}>Audio</button>
  </div>

  {#if activeTab === 'palette'}
    <div class="tab-panel">
      {#each rows as row (row.name)}
        <div class="token-row">
          <input
            class="token-name"
            type="text"
            value={row.name}
            onchange={(e) => handleRename(row.name, e.target.value)}
          />
          {#if row.kind === 'color'}
            <LivePreview commands={[swatchCommand(row.value)]} cols={1} rows={1} {metrics} {fontFamily} palette={livePalette} />
            <input type="text" value={row.value} oninput={(e) => handleColorChange(row.name, e.target.value)} />
          {:else}
            <span class="gradient-tag">gradient</span>
          {/if}
          <button onclick={() => handleRemoveToken(row.name)} title="Remove">✕</button>
        </div>

        {#if row.kind === 'gradient'}
          <div class="gradient-editor">
            <label class="field">
              <span class="key">direction</span>
              <select value={row.value.direction} onchange={(e) => handleDirectionChange(row.name, e.target.value)}>
                <option value="vertical">vertical</option>
                <option value="horizontal">horizontal</option>
              </select>
            </label>
            {#each row.value.stops as stop, index (index)}
              <div class="stop-row">
                <span class="stop-index">stop {index}</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={stop.offset}
                  oninput={(e) => handleStopOffsetChange(row.name, index, Number(e.target.value))}
                />
                <LivePreview commands={[swatchCommand(stop.color)]} cols={1} rows={1} {metrics} {fontFamily} palette={livePalette} />
                <label class="token-ref-toggle">
                  <input
                    type="checkbox"
                    checked={isStopTokenRef(stop.color)}
                    onchange={() => toggleStopKind(row.name, index, stop.color)}
                  />
                  token ref
                </label>
                {#if isStopTokenRef(stop.color)}
                  <select
                    value={stop.color.token}
                    onchange={(e) => handleStopColorChange(row.name, index, { token: e.target.value })}
                  >
                    {#each Object.keys(tokens).filter((key) => key !== row.name) as tokenName (tokenName)}
                      <option value={tokenName}>{tokenName}</option>
                    {/each}
                  </select>
                {:else}
                  <input type="text" value={stop.color} oninput={(e) => handleStopColorChange(row.name, index, e.target.value)} />
                {/if}
                <button onclick={() => handleRemoveStop(row.name, index)} title="Remove stop">✕</button>
              </div>
            {/each}
            <button onclick={() => handleAddStop(row.name)}>Add stop</button>
          </div>
        {/if}
      {/each}

      <div class="add-token">
        <input type="text" bind:value={newTokenName} placeholder="new-token-name" />
        <button onclick={handleAddToken} disabled={!newTokenName.trim()}>Add token</button>
      </div>

      <div class="save-panel">
        <label class="field">
          <span class="key">path</span>
          <input type="text" bind:value={destinationPath} />
        </label>
        <button onclick={handleSave} disabled={saveStatus === 'checking' || saveStatus === 'pending'}>Save</button>
        {#if saveStatus === 'checking'}
          <span class="save-status">Checking…</span>
        {:else if saveStatus === 'pending'}
          <span class="save-status">Writing…</span>
        {:else if saveStatus?.ok}
          <span class="save-status ok">Written.</span>
        {:else if saveStatus && saveStatus !== 'confirm-overwrite' && !saveStatus.ok}
          <span class="save-status error">{saveStatus.error}</span>
        {/if}
      </div>

      {#if saveStatus === 'confirm-overwrite'}
        <div class="overwrite-banner">
          <span>⚠ {destinationPath} already exists.</span>
          <button onclick={writePalette}>Overwrite</button>
          <button onclick={cancelOverwrite}>Cancel</button>
        </div>
      {/if}
    </div>
  {:else if activeTab === 'keybindings'}
    <p class="empty">Keybindings tab: coming in a later checkpoint.</p>
  {:else}
    <p class="empty">Audio tab: coming in a later checkpoint.</p>
  {/if}
</div>

<style>
  .config-ui {
    margin-top: 0.5rem;
  }

  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .tabs button {
    font-family: inherit;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
    padding: 0.25rem 0.6rem;
  }

  .tabs button.active {
    background: #2b3a4a;
    border-color: #6ab0ff;
    color: #6ab0ff;
  }

  .tab-panel {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .token-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .token-name {
    font-family: inherit;
    font-size: 0.85rem;
    width: 12ch;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }

  .gradient-tag {
    color: #e0a030;
    font-size: 0.8rem;
  }

  .gradient-editor {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0 0 0.4rem 2rem;
    padding: 0.4rem;
    border-left: 2px solid #444;
  }

  .stop-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }

  .stop-index {
    color: #888;
    min-width: 6ch;
  }

  .token-ref-toggle {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    color: #888;
    font-size: 0.8rem;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .key {
    min-width: 6ch;
    color: #ddd;
  }

  select,
  input[type='number'],
  input[type='text'] {
    font-family: inherit;
    font-size: 0.85rem;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }

  button {
    font-family: inherit;
  }

  .add-token {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }

  .save-panel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid #444;
  }

  .save-status {
    color: #888;
  }

  .save-status.ok {
    color: #6ab0ff;
  }

  .save-status.error {
    color: #e06666;
  }

  .overwrite-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #2b1a1a;
    border: 1px solid #e06666;
    color: #e06666;
  }

  .empty {
    color: #888;
  }
</style>
