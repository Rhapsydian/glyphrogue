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
  import { get as getRegistryEntry } from '@glyphrogue/core';

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

  let paramsDefaults = $derived(generatorId ? (getRegistryEntry(api.registry, generatorId)?.paramsDefaults ?? {}) : {});

  // Stale values from a previously-selected generator's own param shape
  // must not leak into a newly-selected one.
  $effect(() => {
    paramsValues = { ...paramsDefaults };
  });

  let commands = $derived(scratchZone ? zoneToCommands(scratchZone, { tileset, fontSources, metrics }) : []);

  function randomizeSeed() {
    seed = Math.floor(Math.random() * 2 ** 31);
  }

  function handleGenerate() {
    if (!generatorId) return;
    scratchZone = api.generateZone({
      generatorId,
      zoneId: SCRATCH_ZONE_ID,
      worldSeed: seed,
      params: { width, height, ...paramsValues },
    });
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

      <button onclick={handleGenerate} disabled={!generatorId}>Generate</button>
    </div>

    <div class="preview-panel">
      {#if scratchZone}
        <LivePreview {commands} cols={scratchZone.width} rows={scratchZone.height} {metrics} {fontFamily} {palette} />
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
</style>
