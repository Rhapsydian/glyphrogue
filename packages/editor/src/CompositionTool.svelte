<script>
  // The generator composition tool (docs/design/editor.md: "Generator
  // composition tool") - assemble several of the four region-scoped
  // primitives against different regions of one zone via an ordered step
  // list, auto-connecting consecutive steps, then emit real generatorFn
  // source. A flat single-file screen, same precedent MapEditor.svelte set:
  // preview/step-list/marquee/export state is all shared across one panel
  // rather than pre-split into subcomponents. Unlike MapEditor, this tool
  // never touches a registry/api - it builds its own scratch zone directly
  // via createZone + composeZone, so no `api` prop is needed here.
  import LivePreview from './LivePreview.svelte';
  import NarrowForm from './NarrowForm.svelte';
  import { createZone, createRng, cellSize, createCamera } from '@glyphrogue/core';
  import { pixelToWorldCell, normalizeMarqueeBounds, clampBoundsToZone } from './pinRegion.js';
  import { buildDefaultTileset, zoneToCommands } from './zoneRender.js';
  import { COMPOSITION_GENERATORS, getCompositionGenerator } from './compositionGenerators.js';
  import {
    addStep,
    removeStep,
    moveStep,
    composeZone,
    composedGeneratorPath,
    isValidExportName,
    generateComposedSource,
  } from './compositionSteps.js';

  let { metrics, fontFamily, palette, fontSources, onExport, onCheckExists } = $props();

  const tileset = buildDefaultTileset();

  let width = $state(20);
  let height = $state(15);
  let seed = $state(1);
  let steps = $state([]);

  // Re-seeded fresh from `steps`/`seed`/`width`/`height` any time any of
  // them change - deterministic, non-jittery preview, same seed-as-explicit-
  // input convention MapEditor.svelte's own seed field follows. Always a
  // real zone (even with zero steps), unlike MapEditor's scratchZone, which
  // stays null until an explicit Generate - there's no separate "generate"
  // action here since steps already gate what actually changes the preview.
  let scratchZone = $derived.by(() => composeZone(createZone(width, height), createRng(seed), steps));

  let previewCellSize = $derived(cellSize(metrics));
  let camera = $derived(createCamera({ x: 0, y: 0, viewportWidth: width, viewportHeight: height }));
  let commands = $derived(zoneToCommands(scratchZone, { tileset, fontSources, metrics }));

  // Add-step sub-panel: pick a generator, drag a region, tune params, add.
  let pendingGeneratorId = $state(COMPOSITION_GENERATORS[0]?.id ?? null);
  let pendingParamsValues = $state({});
  let pendingRegion = $state(null);
  let dragStart = $state(null);
  let dragEnd = $state(null);
  let dragging = $state(false);

  let pendingParamsDefaults = $derived(getCompositionGenerator(pendingGeneratorId)?.paramsDefaults ?? {});

  // Stale values from a previously-picked generator's own param shape must
  // not leak into a newly-picked one's, same effect MapEditor.svelte uses.
  $effect(() => {
    pendingParamsValues = { ...pendingParamsDefaults };
  });

  let liveDragBounds = $derived(
    dragging && dragStart && dragEnd ? clampBoundsToZone(normalizeMarqueeBounds(dragStart, dragEnd), scratchZone) : null
  );

  let canAddStep = $derived(Boolean(pendingGeneratorId && pendingRegion && pendingRegion.width > 0 && pendingRegion.height > 0));

  function handleMarqueeDown(event) {
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
    if (dragStart && dragEnd) {
      const bounds = clampBoundsToZone(normalizeMarqueeBounds(dragStart, dragEnd), scratchZone);
      pendingRegion = bounds.width > 0 && bounds.height > 0 ? bounds : null;
    }
    dragStart = null;
    dragEnd = null;
  }

  function handleAddStep() {
    if (!canAddStep) return;
    steps = addStep(steps, { generatorId: pendingGeneratorId, region: pendingRegion, params: pendingParamsValues });
    pendingRegion = null;
  }

  function regionBoxStyle(bounds) {
    return `left:${bounds.x * previewCellSize.width}px; top:${bounds.y * previewCellSize.height}px; width:${bounds.width * previewCellSize.width}px; height:${bounds.height * previewCellSize.height}px;`;
  }

  // Export: name -> /exists check -> write, or -> an explicit overwrite
  // confirmation if the path is already taken (editor.md: "loud, never
  // silent"). No modal component exists anywhere in this codebase, so this
  // is an inline banner, same status-line density MapEditor.svelte's own
  // exportStatus already uses.
  let exportName = $state('');
  let exportStatus = $state(null); // null | 'checking' | 'confirm-overwrite' | 'pending' | { ok, error? }
  let exportNameValid = $derived(isValidExportName(exportName));
  let canSave = $derived(exportNameValid && steps.length > 0 && exportStatus !== 'checking' && exportStatus !== 'pending');

  async function writeComposed() {
    exportStatus = 'pending';
    const source = generateComposedSource(steps, { width, height });
    exportStatus = await onExport(composedGeneratorPath(exportName), source, {
      tool: 'generator-composition',
      label: `composed generator: ${exportName}`,
    });
  }

  async function handleSave() {
    if (!canSave) return;
    exportStatus = 'checking';
    const { exists } = await onCheckExists(composedGeneratorPath(exportName));
    if (exists) {
      exportStatus = 'confirm-overwrite';
      return;
    }
    await writeComposed();
  }

  function cancelOverwrite() {
    exportStatus = null;
  }
</script>

<div class="composition-tool">
  <div class="zone-config">
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
  </div>

  <div class="panels">
    <div class="steps-panel">
      <h3>Steps</h3>
      {#if steps.length === 0}
        <p class="empty">No steps yet.</p>
      {:else}
        {#each steps as step, index (index)}
          <div class="step-row">
            <span class="step-index">{index + 1}.</span>
            <span class="step-label">{getCompositionGenerator(step.generatorId)?.label ?? step.generatorId}</span>
            <span class="step-region">({step.region.x},{step.region.y}) {step.region.width}×{step.region.height}</span>
            <button onclick={() => (steps = moveStep(steps, index, -1))} disabled={index === 0} title="Move up">↑</button>
            <button onclick={() => (steps = moveStep(steps, index, 1))} disabled={index === steps.length - 1} title="Move down">↓</button>
            <button onclick={() => (steps = removeStep(steps, index))} title="Remove">✕</button>
          </div>
        {/each}
      {/if}

      <div class="add-step">
        <h4>Add step</h4>
        <label class="field">
          <span class="key">generator</span>
          <select bind:value={pendingGeneratorId}>
            {#each COMPOSITION_GENERATORS as generator (generator.id)}
              <option value={generator.id}>{generator.label}</option>
            {/each}
          </select>
        </label>
        <p class="hint">Drag a region on the preview to pick where this step runs.</p>
        {#if pendingRegion}
          <p class="hint">Region: ({pendingRegion.x},{pendingRegion.y}) {pendingRegion.width}×{pendingRegion.height}</p>
        {/if}
        <NarrowForm
          defaults={pendingParamsDefaults}
          values={pendingParamsValues}
          onChange={(key, value) => (pendingParamsValues = { ...pendingParamsValues, [key]: value })}
        />
        <button onclick={handleAddStep} disabled={!canAddStep}>Add step</button>
      </div>
    </div>

    <div class="preview-panel">
      <div class="preview-stack" style="width:{width * previewCellSize.width}px; height:{height * previewCellSize.height}px;">
        <LivePreview {commands} cols={width} rows={height} {metrics} {fontFamily} {palette} />
        <div
          class="marquee-overlay"
          onmousedown={handleMarqueeDown}
          onmousemove={handleMarqueeMove}
          onmouseup={handleMarqueeUp}
          onmouseleave={handleMarqueeUp}
        ></div>
        {#if pendingRegion}
          <div class="region-box pin-box" style={regionBoxStyle(pendingRegion)}></div>
        {/if}
        {#if liveDragBounds}
          <div class="region-box drag-box" style={regionBoxStyle(liveDragBounds)}></div>
        {/if}
      </div>
    </div>
  </div>

  <div class="export-panel">
    <label class="field">
      <span class="key">name</span>
      <input type="text" bind:value={exportName} placeholder="my-composed-generator" />
    </label>
    <button onclick={handleSave} disabled={!canSave}>Save</button>
    {#if exportStatus === 'checking'}
      <span class="export-status">Checking…</span>
    {:else if exportStatus === 'pending'}
      <span class="export-status">Writing…</span>
    {:else if exportStatus?.ok}
      <span class="export-status ok">Written.</span>
    {:else if exportStatus && exportStatus !== 'confirm-overwrite' && !exportStatus.ok}
      <span class="export-status error">{exportStatus.error}</span>
    {/if}
  </div>

  {#if exportStatus === 'confirm-overwrite'}
    <div class="overwrite-banner">
      <span>⚠ {composedGeneratorPath(exportName)} already exists.</span>
      <button onclick={writeComposed}>Overwrite</button>
      <button onclick={cancelOverwrite}>Cancel</button>
    </div>
  {/if}
</div>

<style>
  .composition-tool {
    margin-top: 0.5rem;
  }

  .zone-config {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .panels {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .steps-panel {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 18rem;
  }

  h3,
  h4 {
    margin: 0;
    font-size: 0.9rem;
    color: #ddd;
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
  }

  .step-index {
    color: #888;
  }

  .step-label {
    color: #6ab0ff;
    min-width: 10ch;
  }

  .step-region {
    color: #888;
  }

  .add-step {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #444;
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

  .hint {
    margin: 0;
    color: #888;
    font-size: 0.8rem;
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

  .export-panel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid #444;
  }

  .export-status {
    color: #888;
  }

  .export-status.ok {
    color: #6ab0ff;
  }

  .export-status.error {
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
</style>
