<script>
  // The map editor (docs/design/editor.md: "Map editor"), standalone
  // authoring only this session - generate/tune a scratch zone that never
  // touches a live world. In-context editing, override export, and pin/lock
  // (checkpoint 2) / export (checkpoint 3) land in later checkpoints of the
  // same session; this file grows across all three rather than being
  // re-split later, since they all share this one panel's state.
  import LivePreview from './LivePreview.svelte';
  import NarrowForm from './NarrowForm.svelte';
  import { listGeneratorIds } from './generatorCatalog.js';
  import { buildDefaultTileset, zoneToCommands } from './zoneRender.js';
  import {
    pixelToWorldCell,
    normalizeMarqueeBounds,
    clampBoundsToZone,
    snapshotRegion,
    patchRegionIntoZone,
  } from './pinRegion.js';
  import { get as getRegistryEntry, cellSize, createCamera } from '@glyphrogue/core';

  let { api, metrics, fontFamily, palette, fontSources, onExport } = $props();

  // Never carried in an exported shape (templates/presets vary output via
  // seed/params, not zoneId) - a fixed scratch id keeps this a single knob
  // instead of a second, redundant one.
  const SCRATCH_ZONE_ID = 'editor-scratch-zone';

  const generatorIds = listGeneratorIds(api.registry);
  const tileset = buildDefaultTileset();

  let generatorId = $state(generatorIds[0] ?? null);
  let width = $state(20);
  let height = $state(12);
  let seed = $state(1);
  let paramsValues = $state({});
  let scratchZone = $state(null);

  // Pin/lock (checkpoint 2): a single active pin at a time, matching both
  // editor.md's and mapgen-and-editor.md's singular framing - a new drag
  // replaces the previous pin. dragStart/dragEnd/dragging are transient
  // marquee-in-progress state, not persisted once the drag ends.
  let pinnedRegion = $state(null);
  let dragStart = $state(null);
  let dragEnd = $state(null);
  let dragging = $state(false);

  let paramsDefaults = $derived(generatorId ? (getRegistryEntry(api.registry, generatorId)?.paramsDefaults ?? {}) : {});

  // Stale values from a previously-selected generator's own param shape
  // must not leak into a newly-selected one.
  $effect(() => {
    paramsValues = { ...paramsDefaults };
  });

  let commands = $derived(scratchZone ? zoneToCommands(scratchZone, { tileset, fontSources, metrics }) : []);
  let previewCellSize = $derived(cellSize(metrics));
  // Standalone authoring has no real scroll - an identity camera exists
  // purely so pin/lock's coordinate math genuinely reuses camera.js's
  // screenToWorld rather than a hand-rolled offset, per editor.md's "no new
  // coordinate mechanism" requirement.
  let camera = $derived(scratchZone ? createCamera({ x: 0, y: 0, viewportWidth: scratchZone.width, viewportHeight: scratchZone.height }) : null);
  let liveDragBounds = $derived(
    dragging && dragStart && dragEnd && scratchZone ? clampBoundsToZone(normalizeMarqueeBounds(dragStart, dragEnd), scratchZone) : null,
  );

  function randomizeSeed() {
    seed = Math.floor(Math.random() * 2 ** 31);
  }

  function handleGenerate() {
    if (!generatorId) return;
    const freshZone = api.generateZone({
      generatorId,
      zoneId: SCRATCH_ZONE_ID,
      worldSeed: seed,
      params: { width, height, ...paramsValues },
    });
    scratchZone = pinnedRegion ? patchRegionIntoZone(freshZone, pinnedRegion) : freshZone;
  }

  function handleMarqueeDown(event) {
    if (!scratchZone) return;
    dragging = true;
    dragStart = pixelToWorldCell(event.offsetX, event.offsetY, previewCellSize, camera);
    dragEnd = dragStart;
  }

  function handleMarqueeMove(event) {
    if (!dragging) return;
    dragEnd = pixelToWorldCell(event.offsetX, event.offsetY, previewCellSize, camera);
  }

  function handleMarqueeUp() {
    if (!dragging) return;
    dragging = false;
    if (dragStart && dragEnd && scratchZone) {
      const bounds = clampBoundsToZone(normalizeMarqueeBounds(dragStart, dragEnd), scratchZone);
      if (bounds.width > 0 && bounds.height > 0) {
        pinnedRegion = snapshotRegion(scratchZone, bounds);
      }
    }
    dragStart = null;
    dragEnd = null;
  }

  function clearPin() {
    pinnedRegion = null;
  }

  function regionBoxStyle(bounds) {
    return `left:${bounds.x * previewCellSize.width}px; top:${bounds.y * previewCellSize.height}px; width:${bounds.width * previewCellSize.width}px; height:${bounds.height * previewCellSize.height}px;`;
  }
</script>

<div class="map-editor">
  <div class="panels">
    <div class="params-panel">
      <label class="field">
        <span class="key">generator</span>
        <select bind:value={generatorId}>
          {#each generatorIds as id (id)}
            <option value={id}>{id}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="key">width</span>
        <input type="number" min="1" bind:value={width} />
      </label>
      <label class="field">
        <span class="key">height</span>
        <input type="number" min="1" bind:value={height} />
      </label>
      <label class="field">
        <span class="key">seed</span>
        <input type="number" bind:value={seed} />
      </label>
      <button onclick={randomizeSeed}>Randomize seed</button>

      <NarrowForm
        defaults={paramsDefaults}
        values={paramsValues}
        onChange={(key, value) => (paramsValues = { ...paramsValues, [key]: value })}
      />

      <button onclick={handleGenerate} disabled={!generatorId}>
        {pinnedRegion ? 'Generate (pinned region preserved)' : 'Generate'}
      </button>
      {#if pinnedRegion}
        <button onclick={clearPin}>Clear pin</button>
      {/if}
    </div>

    <div class="preview-panel">
      {#if scratchZone}
        <div class="preview-stack" style="width:{scratchZone.width * previewCellSize.width}px; height:{scratchZone.height * previewCellSize.height}px;">
          <LivePreview {commands} cols={scratchZone.width} rows={scratchZone.height} {metrics} {fontFamily} {palette} />
          <div
            class="marquee-overlay"
            onmousedown={handleMarqueeDown}
            onmousemove={handleMarqueeMove}
            onmouseup={handleMarqueeUp}
            onmouseleave={handleMarqueeUp}
          ></div>
          {#if pinnedRegion}
            <div class="region-box pin-box" style={regionBoxStyle(pinnedRegion.bounds)}></div>
          {/if}
          {#if liveDragBounds}
            <div class="region-box drag-box" style={regionBoxStyle(liveDragBounds)}></div>
          {/if}
        </div>
      {:else}
        <p class="empty">No zone generated yet.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .map-editor {
    margin-top: 0.5rem;
  }

  .panels {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .params-panel {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 16rem;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .key {
    min-width: 8ch;
    color: #ddd;
  }

  select,
  input[type='number'] {
    font-family: inherit;
    font-size: 0.85rem;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }

  button {
    font-family: inherit;
    align-self: flex-start;
  }

  .empty {
    color: #888;
  }

  .preview-stack {
    position: relative;
  }

  .marquee-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    cursor: crosshair;
  }

  .region-box {
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
  }

  .pin-box {
    border: 2px solid #e0a030;
    background: rgba(224, 160, 48, 0.15);
  }

  .drag-box {
    border: 1px dashed #6ab0ff;
    background: rgba(106, 176, 255, 0.15);
  }
</style>
