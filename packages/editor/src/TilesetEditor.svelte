<script>
  // Tileset/font-calibration editor (docs/design/editor.md: "Tileset/
  // font-calibration editor") - two tabs mirroring ContentBrowser.svelte's
  // own layout pattern: calibration tuning (this checkpoint) and symbol/
  // tileset authoring (next checkpoint).
  import { register, getFontSource, setReferenceFontSource } from '@glyphrogue/core';
  import LivePreview from './LivePreview.svelte';
  import {
    listFontSourceIds,
    isReferenceFontSource,
    buildCalibrationCommands,
  } from './tilesetCatalog.js';

  let { metrics, fontFamily, palette, fontSources, tileset } = $props();

  // fontSources/tileset mutate an internal Map in place (registry.js) -
  // Svelte 5's fine-grained reactivity has no way to see that on its own, so
  // every mutating action below bumps this and every catalog-derived value
  // reads it first, same workaround ContentBrowser.svelte's liveRefreshToken
  // already uses for the same underlying reason.
  let refreshToken = $state(0);

  let view = $state('calibration');
  let selectedSourceId = $state(null);
  let pendingReferenceChange = $state(false);

  let fontSourceIds = $derived.by(() => {
    refreshToken;
    return listFontSourceIds(fontSources);
  });

  // Read once here (gated on refreshToken, unlike the plain
  // isReferenceFontSource import) so the list-panel's per-row badge stays
  // reactive - calling isReferenceFontSource directly inside the {#each}
  // template read the live registry with no refreshToken dependency, so it
  // never re-ran after setReferenceFontSource mutated it in place.
  let currentReferenceId = $derived.by(() => {
    refreshToken;
    return fontSources.referenceId;
  });

  let selectedEntry = $derived.by(() => {
    refreshToken;
    return selectedSourceId ? getFontSource(fontSources, selectedSourceId) : null;
  });

  let selectedIsReference = $derived.by(() => {
    refreshToken;
    return selectedSourceId ? isReferenceFontSource(fontSources, selectedSourceId) : false;
  });

  let calibrationCommands = $derived.by(() => {
    refreshToken;
    return selectedSourceId ? buildCalibrationCommands(fontSources, metrics, selectedSourceId) : [];
  });

  // The only mode deriveCalibration/glyphRenderer.js actually implement
  // today (fontSources.js hardcodes 'advance') - not fabricating options
  // that don't exist just because the field is shaped like an enum.
  const HORIZONTAL_CENTERING_MODES = ['advance'];

  function selectSource(id) {
    selectedSourceId = id;
    pendingReferenceChange = false;
  }

  // Bypasses registerFontSource deliberately - it always internally
  // re-derives calibration from sourceMetrics/the current reference, so
  // routing a slider value through it would silently discard whatever the
  // author just dragged to. Mutating the raw registry directly via
  // options.override is the only way a manual override persists.
  function updateCalibration(patch) {
    const entry = getFontSource(fontSources, selectedSourceId);
    const calibration = { ...entry.calibration, ...patch };
    register(fontSources.registry, selectedSourceId, { sourceMetrics: entry.sourceMetrics, calibration }, { override: selectedSourceId });
    refreshToken += 1;
  }

  function requestReferenceChange() {
    pendingReferenceChange = true;
  }

  function cancelReferenceChange() {
    pendingReferenceChange = false;
  }

  function confirmReferenceChange() {
    setReferenceFontSource(fontSources, selectedSourceId);
    refreshToken += 1;
    pendingReferenceChange = false;
  }
</script>

<section class="tileset-editor">
  <div class="view-toggle">
    <button class:active={view === 'calibration'} onclick={() => (view = 'calibration')}>Calibration</button>
    <button class:active={view === 'symbols'} onclick={() => (view = 'symbols')}>Symbols</button>
  </div>

  {#if view === 'calibration'}
    <div class="panels">
      <div class="list-panel">
        {#if fontSourceIds.length === 0}
          <p class="empty">No font sources registered.</p>
        {:else}
          <ul>
            {#each fontSourceIds as id (id)}
              <li>
                <button class="row" class:selected={selectedSourceId === id} onclick={() => selectSource(id)}>
                  <span class="id">{id}</span>
                  {#if currentReferenceId === id}<span class="badge">reference</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="detail-panel">
        {#if !selectedEntry}
          <p class="empty">Select a font source to tune its calibration.</p>
        {:else}
          <h4>{selectedSourceId}</h4>

          {#if selectedIsReference}
            <p class="note">This is the reference source - not meaningfully editable relative to itself.</p>
          {:else}
            <label>
              scale
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.01"
                value={selectedEntry.calibration.scale}
                oninput={(e) => updateCalibration({ scale: Number(e.target.value) })}
              />
              <span class="value">{selectedEntry.calibration.scale.toFixed(2)}</span>
            </label>
            <label>
              baselineOffset
              <input
                type="range"
                min="-0.5"
                max="0.5"
                step="0.01"
                value={selectedEntry.calibration.baselineOffset}
                oninput={(e) => updateCalibration({ baselineOffset: Number(e.target.value) })}
              />
              <span class="value">{selectedEntry.calibration.baselineOffset.toFixed(2)}</span>
            </label>
            <label>
              horizontalCenteringMode
              <select
                value={selectedEntry.calibration.horizontalCenteringMode}
                onchange={(e) => updateCalibration({ horizontalCenteringMode: e.target.value })}
              >
                {#each HORIZONTAL_CENTERING_MODES as mode (mode)}
                  <option value={mode}>{mode}</option>
                {/each}
              </select>
            </label>

            <button onclick={requestReferenceChange}>Set as reference</button>
            {#if pendingReferenceChange}
              <div class="overwrite-banner">
                <span>⚠ Set "{selectedSourceId}" as reference? This recalculates {fontSourceIds.length - 1} other source(s)' calibration.</span>
                <button onclick={confirmReferenceChange}>Confirm</button>
                <button onclick={cancelReferenceChange}>Cancel</button>
              </div>
            {/if}
          {/if}

          <div class="preview">
            <LivePreview commands={calibrationCommands} cols={8} rows={1} {metrics} {fontFamily} {palette} />
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <p class="empty">Symbol authoring — coming in the next checkpoint.</p>
  {/if}
</section>

<style>
  .tileset-editor {
    margin-top: 0.5rem;
  }

  .view-toggle {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .view-toggle button {
    font-family: inherit;
    font-size: 0.85rem;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }

  .view-toggle button.active {
    background: #6ab0ff;
    color: #1e1e1e;
    border-color: #6ab0ff;
  }

  .panels {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .list-panel {
    min-width: 18rem;
    max-height: 20rem;
    overflow-y: auto;
    border: 1px solid #444;
  }

  .list-panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    width: 100%;
    gap: 0.5rem;
    align-items: center;
    text-align: left;
    font-family: inherit;
    font-size: 0.85rem;
    background: none;
    color: #ddd;
    border: none;
    border-bottom: 1px solid #333;
    padding: 0.25rem 0.4rem;
  }

  .row.selected {
    background: #2b3a4a;
  }

  .badge {
    font-size: 0.7rem;
    color: #6ab0ff;
    border: 1px solid #6ab0ff;
    border-radius: 2px;
    padding: 0 0.3rem;
  }

  .detail-panel {
    flex: 1;
    min-width: 16rem;
  }

  .detail-panel h4 {
    margin: 0 0 0.4rem;
  }

  .detail-panel label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #ddd;
    margin-bottom: 0.4rem;
  }

  .value {
    color: #888;
    min-width: 4ch;
  }

  .note {
    color: #888;
    font-size: 0.85rem;
  }

  .preview {
    margin-top: 0.6rem;
  }

  .empty {
    color: #888;
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
</style>
