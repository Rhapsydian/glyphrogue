<script>
  // Content browser (docs/design/editor.md: "Content browser"). Two
  // independently-sourced views per that section's decisions - registry
  // (recordingApi manifest, no live game needed) and live (the actual
  // running world) - kept as one local view toggle rather than a new
  // App.svelte-level tab/router, since every other tool section there
  // stays a flat always-visible block.
  import { deriveManifest, filterManifest, componentIndex, entityTypeRuleIndex } from './contentCatalog.js';

  let { api, enabledPlugins } = $props();

  const ALL_KINDS = ['rule', 'generator', 'entity', 'entityType', 'screen', 'sound', 'scriptedEvent', 'service', 'plugin'];

  let view = $state('registry');

  // Registry view state.
  let manifest = $derived(deriveManifest(enabledPlugins));
  let search = $state('');
  let activeKinds = $state(new Set(ALL_KINDS));
  let referencedComponent = $state(null);
  let referencedEntityType = $state(null);
  let selectedKey = $state(null);

  let filtered = $derived(
    filterManifest(manifest, {
      kinds: [...activeKinds],
      search,
      referencedComponent,
      referencedEntityType,
    }),
  );
  let selectedEntry = $derived(filtered.find((entry) => `${entry.kind}:${entry.id}` === selectedKey) ?? null);
  let componentsForSelected = $derived(componentIndex(manifest));
  let entityTypeRulesIndex = $derived(entityTypeRuleIndex(manifest));

  function toggleKind(kind) {
    const next = new Set(activeKinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    activeKinds = next;
  }

  function selectEntry(entry) {
    selectedKey = `${entry.kind}:${entry.id}`;
  }

  function showRulesForComponent(componentName) {
    referencedEntityType = null;
    referencedComponent = componentName;
    selectedKey = null;
  }

  function showRulesForEntityType(entityTypeId) {
    referencedComponent = null;
    referencedEntityType = entityTypeId;
    selectedKey = null;
  }

  function clearReferenceFilter() {
    referencedComponent = null;
    referencedEntityType = null;
    selectedKey = null;
  }

  // Cross-navigation shortcut (editor.md): jump from an entity type's
  // detail panel into the live view, pre-filtered to entities carrying
  // every component that type declares. Instantiated entities carry no
  // retained "which entityType created me" tag (definitions.js decomposes
  // registerEntityType into a plain registerEntity + rules, no marker
  // stored) so declared-component overlap is the closest available proxy.
  function showLiveInstancesOf(entry) {
    requiredComponents = entry.components ?? [];
    liveComponentFilter = '';
    view = 'live';
  }

  // Live view state.
  let liveSearch = $state('');
  let liveComponentFilter = $state('');
  // Set only via showLiveInstancesOf, above - a stricter "has every one of
  // these" AND filter, distinct from liveComponentFilter's manual
  // single-component dropdown, since matching a whole entity type's
  // declared set needs all of them present, not just one.
  let requiredComponents = $state([]);
  let selectedEntityId = $state(null);
  let liveRefreshToken = $state(0);

  // world.js's query(world, types) - an empty types array is vacuously
  // true for every entity, so this is the whole live entity set with no
  // new core primitive needed. Re-derives on refresh only, not polled -
  // the dev fixture's world changes only via explicit actions.
  let liveEntities = $derived.by(() => {
    liveRefreshToken;
    return api.query([]).map((entity) => ({ entity, components: api.getComponentsForEntity(entity) }));
  });

  let filteredLiveEntities = $derived(
    liveEntities.filter(({ entity, components }) => {
      if (requiredComponents.length > 0 && !requiredComponents.every((name) => name in components)) return false;
      if (liveComponentFilter && !(liveComponentFilter in components)) return false;
      if (!liveSearch) return true;
      const needle = liveSearch.toLowerCase();
      return String(entity).includes(needle) || Object.keys(components).some((name) => name.toLowerCase().includes(needle));
    }),
  );

  function clearRequiredComponents() {
    requiredComponents = [];
  }

  let selectedEntityComponents = $derived(
    selectedEntityId != null ? (liveEntities.find((e) => e.entity === selectedEntityId)?.components ?? null) : null,
  );

  let liveComponentNames = $derived([...new Set(liveEntities.flatMap(({ components }) => Object.keys(components)))].sort());

  function refreshLive() {
    liveRefreshToken += 1;
    selectedEntityId = null;
  }
</script>

<section class="content-browser">
  <div class="view-toggle">
    <button class:active={view === 'registry'} onclick={() => (view = 'registry')}>Registry</button>
    <button class:active={view === 'live'} onclick={() => (view = 'live')}>Live</button>
  </div>

  {#if view === 'registry'}
    <div class="controls">
      {#if referencedComponent || referencedEntityType}
        <div class="breadcrumb">
          <span>
            Filtered: rules referencing {referencedComponent ? `component "${referencedComponent}"` : `entity type "${referencedEntityType}"`}
          </span>
          <button onclick={clearReferenceFilter}>Clear</button>
        </div>
      {:else}
        <input type="text" placeholder="Search by id…" bind:value={search} />
        <div class="kinds">
          {#each ALL_KINDS as kind (kind)}
            <label>
              <input type="checkbox" checked={activeKinds.has(kind)} onchange={() => toggleKind(kind)} />
              {kind}
            </label>
          {/each}
        </div>
      {/if}
    </div>

    <div class="panels">
      <div class="list-panel">
        {#if filtered.length === 0}
          <p class="empty">No matching content.</p>
        {:else}
          <ul>
            {#each filtered as entry (entry.kind + ':' + entry.id)}
              <li>
                <button class="row" class:selected={selectedKey === entry.kind + ':' + entry.id} onclick={() => selectEntry(entry)}>
                  <span class="kind">{entry.kind}</span>
                  <span class="id">{entry.id}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="detail-panel">
        {#if !selectedEntry}
          <p class="empty">Select an entry to see its details.</p>
        {:else}
          <h4>{selectedEntry.kind}: {selectedEntry.id}</h4>
          <dl>
            {#each Object.entries(selectedEntry).filter(([key, value]) => key !== 'kind' && key !== 'id' && value !== undefined) as [key, value] (key)}
              <dt>{key}</dt>
              <dd>{JSON.stringify(value)}</dd>
            {/each}
          </dl>

          {#if selectedEntry.kind === 'entityType'}
            <div class="cross-refs">
              <button onclick={() => showLiveInstancesOf(selectedEntry)}>Show live instances →</button>
              {#if entityTypeRulesIndex[selectedEntry.id]?.length}
                <button onclick={() => showRulesForEntityType(selectedEntry.id)}>
                  See {entityTypeRulesIndex[selectedEntry.id].length} matching rule(s)
                </button>
              {/if}
            </div>
          {/if}

          {#if selectedEntry.components}
            <div class="cross-refs">
              {#each ['all', 'any', 'none'].flatMap((bucket) => (selectedEntry.components[bucket] ?? []).map((c) => [bucket, typeof c === 'string' ? c : c.component])) as [bucket, componentName] (bucket + ':' + componentName)}
                <button onclick={() => showRulesForComponent(componentName)}>
                  {bucket}: "{componentName}" → {(componentsForSelected[componentName] ?? []).length} referencing rule(s)
                </button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {:else}
    <div class="controls">
      {#if requiredComponents.length > 0}
        <div class="breadcrumb">
          <span>Filtered: entities with components [{requiredComponents.join(', ')}]</span>
          <button onclick={clearRequiredComponents}>Clear</button>
        </div>
      {/if}
      <input type="text" placeholder="Search by entity id or component…" bind:value={liveSearch} />
      <select bind:value={liveComponentFilter}>
        <option value="">(any component)</option>
        {#each liveComponentNames as name (name)}
          <option value={name}>{name}</option>
        {/each}
      </select>
      <button onclick={refreshLive}>Refresh</button>
    </div>

    <div class="panels">
      <div class="list-panel">
        {#if filteredLiveEntities.length === 0}
          <p class="empty">No live entities match.</p>
        {:else}
          <ul>
            {#each filteredLiveEntities as { entity, components } (entity)}
              <li>
                <button class="row" class:selected={selectedEntityId === entity} onclick={() => (selectedEntityId = entity)}>
                  <span class="id">#{entity}</span>
                  <span class="components">{Object.keys(components).join(', ')}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="detail-panel">
        {#if selectedEntityId == null}
          <p class="empty">Select an entity to see its live components.</p>
        {:else}
          <h4>entity #{selectedEntityId}</h4>
          <dl>
            {#each Object.entries(selectedEntityComponents ?? {}) as [name, data] (name)}
              <dt>{name}</dt>
              <dd>{JSON.stringify(data)}</dd>
            {/each}
          </dl>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .content-browser {
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

  .controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .controls input[type='text'] {
    font-family: inherit;
    font-size: 0.85rem;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
    width: 20ch;
  }

  select {
    font-family: inherit;
    font-size: 0.85rem;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .kinds label {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: #ddd;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6ab0ff;
    font-size: 0.85rem;
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

  .row .kind {
    min-width: 8ch;
    color: #888;
  }

  .row .components {
    color: #888;
  }

  .detail-panel {
    flex: 1;
    min-width: 16rem;
  }

  .detail-panel h4 {
    margin: 0 0 0.4rem;
  }

  dl {
    margin: 0;
  }

  dt {
    color: #888;
    font-size: 0.8rem;
  }

  dd {
    margin: 0 0 0.4rem;
    word-break: break-word;
  }

  .cross-refs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
    margin-top: 0.5rem;
  }

  .cross-refs button {
    font-family: inherit;
    font-size: 0.8rem;
  }

  .empty {
    color: #888;
  }
</style>
