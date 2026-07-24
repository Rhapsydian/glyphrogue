<script>
  // The behavior wizard (docs/design/editor.md's "Composition wizard",
  // roadmap item 8 - session 38's design conversation superseded the doc's
  // original "never writes a file" prose). Two independent flows, same
  // "flat always-visible tool section, local view toggle" precedent
  // ContentBrowser.svelte set for its own registry/live split: composition
  // plugins (list/create/edit/add-entry/save/delete - entries are plain
  // data, safe to regenerate) and a one-shot custom-rule scaffold (never
  // revisited once written). No `api` prop needed - unlike ContentBrowser's
  // live view, nothing here queries a running world.
  import { deriveManifest } from './contentCatalog.js';
  import {
    attachableBehaviors,
    widenableRules,
    canDeleteComposition,
    generateCompositionSource,
    generateCustomRuleSource,
    isValidExportName,
    pluginFilePath,
  } from './behaviorWizard.js';

  let { pluginContent, enabledPlugins, compositions, onWriteFile, onCheckExists, onDeletePlugin, onRefresh } = $props();

  let tab = $state('compositions');

  let entityTypes = $derived(deriveManifest(enabledPlugins).filter((entry) => entry.kind === 'entityType'));

  // --- Compositions tab ---
  let selectedCompositionId = $state(null); // null = creating new
  let editingId = $state('');
  let editingEntries = $state([]);
  let addEntityTypeId = $state(null);
  let addMode = $state('attach'); // 'attach' | 'widen'
  let saveStatus = $state(null); // null | 'pending' | { ok, error? }
  let deleteStatus = $state(null); // null | 'pending' | { ok, error? }

  let editingIdValid = $derived(isValidExportName(editingId));
  let isEditingExisting = $derived(selectedCompositionId !== null);

  let selectedAddEntityType = $derived(entityTypes.find((entry) => entry.id === addEntityTypeId) ?? null);
  let attachCandidates = $derived(
    selectedAddEntityType ? attachableBehaviors(selectedAddEntityType.components, pluginContent) : [],
  );
  let widenCandidates = $derived(addEntityTypeId ? widenableRules(addEntityTypeId, pluginContent) : []);

  function selectComposition(comp) {
    selectedCompositionId = comp.id;
    editingId = comp.id;
    editingEntries = comp.entries;
    saveStatus = null;
    deleteStatus = null;
  }

  function startNewComposition() {
    selectedCompositionId = null;
    editingId = '';
    editingEntries = [];
    saveStatus = null;
    deleteStatus = null;
  }

  function removeEntry(index) {
    editingEntries = editingEntries.filter((_, i) => i !== index);
  }

  // A candidate can name more than one missing component (a rule's `all`
  // bucket listing several) - attaching it fully means adding every one,
  // so this appends one attach-component entry per missing component.
  function addAttachEntry(candidate) {
    const newEntries = candidate.missingComponents.map((component) => ({
      kind: 'attach-component',
      entityId: addEntityTypeId,
      component,
      data: {},
    }));
    editingEntries = [...editingEntries, ...newEntries];
  }

  function addWidenEntry(candidate) {
    // registeredId (pluginCatalog.js) is the actual id passed to
    // registerRule - candidate.entry.id is the plugin's own id, which only
    // coincides with it by convention, not guarantee.
    const ruleId = candidate.entry.registeredId ?? candidate.entry.id;
    editingEntries = [...editingEntries, { kind: 'widen-rule-types', ruleId, types: candidate.nextTypes }];
  }

  // Zero entries is a valid, saveable state (not just a disallowed empty
  // form) - it's the state a composition has to reach before it becomes
  // eligible for delete (canDeleteComposition requires entries.length ===
  // 0 on the *saved* file). Blocking a zero-entry save would make delete
  // unreachable through this UI - found live while exercising that exact
  // path.
  let canSaveComposition = $derived(editingIdValid && saveStatus !== 'pending');

  async function saveComposition() {
    if (!canSaveComposition) return;
    saveStatus = 'pending';
    const source = generateCompositionSource({ id: editingId, entries: editingEntries });
    const result = await onWriteFile(pluginFilePath(editingId), source, {
      tool: 'behavior-wizard',
      label: `composition: ${editingId}`,
    });
    saveStatus = result;
    if (result.ok) {
      selectedCompositionId = editingId;
      await onRefresh();
    }
  }

  // Delete-eligibility is checked against `compositions` (the last
  // refreshed, on-disk state), not the local `editingEntries` working copy
  // - unsaved edits shouldn't make a still-populated file look deletable,
  // and the server re-validates against the real file regardless.
  let currentComposition = $derived(compositions.find((comp) => comp.id === selectedCompositionId) ?? null);
  let deleteEligibility = $derived(
    currentComposition
      ? canDeleteComposition(
          { id: currentComposition.id, entries: currentComposition.entries, enabled: currentComposition.enabled },
          pluginContent,
        )
      : { ok: false, reasons: ['no composition selected'] },
  );

  async function deleteComposition() {
    if (!deleteEligibility.ok) return;
    deleteStatus = 'pending';
    const result = await onDeletePlugin(selectedCompositionId);
    deleteStatus = result;
    if (result.ok) {
      startNewComposition();
      await onRefresh();
    }
  }

  // --- Custom scaffold tab ---
  let customEntityTypeId = $state(null);
  let customActionType = $state('TakeTurn');
  let customRuleId = $state('');
  let customScope = $state('standalone'); // 'standalone' | 'entity-type-scoped'
  let customMarkerComponent = $state('');
  let customExportStatus = $state(null); // null | 'checking' | 'confirm-overwrite' | 'pending' | { ok, error? }

  // entity-type-scoped: pins to exactly this type via EntityType.equals.
  // standalone: a fresh marker component other entity types could later
  // opt into, same shape Wanders/ChasesPlayer/etc. already use.
  let customComponents = $derived(
    customScope === 'entity-type-scoped' && customEntityTypeId
      ? { all: [{ component: 'EntityType', equals: { type: customEntityTypeId } }] }
      : customMarkerComponent
        ? { all: [customMarkerComponent] }
        : null,
  );
  let customRuleIdValid = $derived(isValidExportName(customRuleId));
  let canGenerateCustom = $derived(
    customRuleIdValid &&
      Boolean(customComponents) &&
      customExportStatus !== 'checking' &&
      customExportStatus !== 'pending',
  );

  async function writeCustom() {
    customExportStatus = 'pending';
    const source = generateCustomRuleSource({
      pluginId: customRuleId,
      ruleId: customRuleId,
      actionType: customActionType,
      components: customComponents,
    });
    customExportStatus = await onWriteFile(pluginFilePath(customRuleId), source, {
      tool: 'behavior-wizard',
      label: `custom rule scaffold: ${customRuleId}`,
    });
  }

  async function generateCustom() {
    if (!canGenerateCustom) return;
    customExportStatus = 'checking';
    const { exists } = await onCheckExists(pluginFilePath(customRuleId));
    if (exists) {
      customExportStatus = 'confirm-overwrite';
      return;
    }
    await writeCustom();
  }

  function cancelCustomOverwrite() {
    customExportStatus = null;
  }
</script>

<section class="behavior-wizard">
  <div class="view-toggle">
    <button class:active={tab === 'compositions'} onclick={() => (tab = 'compositions')}>Compositions</button>
    <button class:active={tab === 'custom'} onclick={() => (tab = 'custom')}>Custom scaffold</button>
  </div>

  {#if tab === 'compositions'}
    <div class="panels">
      <div class="list-panel">
        {#if compositions.length === 0}
          <p class="empty">No composition plugins yet.</p>
        {:else}
          <ul>
            {#each compositions as comp (comp.id)}
              <li>
                <button class="row" class:selected={selectedCompositionId === comp.id} onclick={() => selectComposition(comp)}>
                  <span class="id">{comp.id}</span>
                  <span class="meta">{comp.entries.length} entr{comp.entries.length === 1 ? 'y' : 'ies'} · {comp.enabled ? 'enabled' : 'disabled'}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <button onclick={startNewComposition}>+ New composition…</button>
      </div>

      <div class="detail-panel">
        <label class="field">
          <span class="key">id</span>
          <input type="text" bind:value={editingId} disabled={isEditingExisting} placeholder="guard-patrol" />
        </label>

        <h4>Entries</h4>
        {#if editingEntries.length === 0}
          <p class="empty">No entries yet.</p>
        {:else}
          {#each editingEntries as entry, index (index)}
            <div class="step-row">
              {#if entry.kind === 'attach-component'}
                <span class="step-label">attach</span>
                <span>{entry.component} → {entry.entityId}</span>
              {:else}
                <span class="step-label">widen</span>
                <span>{entry.ruleId} → [{entry.types.join(', ')}]</span>
              {/if}
              <button onclick={() => removeEntry(index)} title="Remove">✕</button>
            </div>
          {/each}
        {/if}

        <div class="add-entry">
          <h4>Add entry</h4>
          <label class="field">
            <span class="key">entity type</span>
            <select bind:value={addEntityTypeId}>
              <option value={null}>—</option>
              {#each entityTypes as entityType (entityType.id)}
                <option value={entityType.id}>{entityType.id}</option>
              {/each}
            </select>
          </label>

          {#if addEntityTypeId}
            <div class="view-toggle">
              <button class:active={addMode === 'attach'} onclick={() => (addMode = 'attach')}>Attach existing behavior</button>
              <button class:active={addMode === 'widen'} onclick={() => (addMode = 'widen')}>Widen a type-scoped rule</button>
            </div>

            {#if addMode === 'attach'}
              {#if attachCandidates.length === 0}
                <p class="empty">No attachable behaviors for this entity type.</p>
              {:else}
                {#each attachCandidates as candidate (candidate.entry.id)}
                  <div class="step-row">
                    <span class="step-label">{candidate.entry.id}</span>
                    <span>adds: {candidate.missingComponents.join(', ')}</span>
                    <span class="hint">({candidate.entry.enabled ? 'enabled' : 'not enabled'})</span>
                    <button onclick={() => addAttachEntry(candidate)}>Add</button>
                  </div>
                {/each}
              {/if}
            {:else if widenCandidates.length === 0}
              <p class="empty">No widenable rules for this entity type.</p>
            {:else}
              {#each widenCandidates as candidate (candidate.entry.id)}
                <div class="step-row">
                  <span class="step-label">{candidate.entry.id}</span>
                  <span>currently: [{candidate.currentTypes.join(', ')}]</span>
                  <button onclick={() => addWidenEntry(candidate)}>Add {addEntityTypeId}</button>
                </div>
              {/each}
            {/if}
          {/if}
        </div>

        <div class="actions-row">
          <button onclick={saveComposition} disabled={!canSaveComposition}>Save</button>
          {#if isEditingExisting}
            <button onclick={deleteComposition} disabled={!deleteEligibility.ok} title={deleteEligibility.reasons.join('; ')}>
              Delete
            </button>
          {/if}
        </div>

        {#if saveStatus === 'pending'}
          <span class="export-status">Saving…</span>
        {:else if saveStatus?.ok}
          <span class="export-status ok">Saved.</span>
        {:else if saveStatus && !saveStatus.ok}
          <span class="export-status error">{saveStatus.error}</span>
        {/if}

        {#if deleteStatus === 'pending'}
          <span class="export-status">Deleting…</span>
        {:else if deleteStatus && !deleteStatus.ok}
          <span class="export-status error">{deleteStatus.error}</span>
        {/if}
      </div>
    </div>
  {:else}
    <div class="custom-scaffold">
      <label class="field">
        <span class="key">entity type</span>
        <select bind:value={customEntityTypeId}>
          <option value={null}>—</option>
          {#each entityTypes as entityType (entityType.id)}
            <option value={entityType.id}>{entityType.id}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="key">action type</span>
        <input type="text" bind:value={customActionType} />
      </label>
      <label class="field">
        <span class="key">rule id</span>
        <input type="text" bind:value={customRuleId} placeholder="guard-alarm" />
      </label>

      <div class="field scope-field">
        <span class="key">scope</span>
        <label><input type="radio" name="scope" value="entity-type-scoped" bind:group={customScope} /> entity-type-scoped</label>
        <label><input type="radio" name="scope" value="standalone" bind:group={customScope} /> standalone/reusable</label>
      </div>

      {#if customScope === 'standalone'}
        <label class="field">
          <span class="key">marker component</span>
          <input type="text" bind:value={customMarkerComponent} placeholder="MyBehavior" />
        </label>
      {/if}

      <button onclick={generateCustom} disabled={!canGenerateCustom}>Generate &amp; save…</button>

      {#if customExportStatus === 'checking'}
        <span class="export-status">Checking…</span>
      {:else if customExportStatus === 'pending'}
        <span class="export-status">Writing…</span>
      {:else if customExportStatus?.ok}
        <span class="export-status ok">Written.</span>
      {:else if customExportStatus && customExportStatus !== 'confirm-overwrite' && !customExportStatus.ok}
        <span class="export-status error">{customExportStatus.error}</span>
      {/if}

      {#if customExportStatus === 'confirm-overwrite'}
        <div class="overwrite-banner">
          <span>⚠ {pluginFilePath(customRuleId)} already exists.</span>
          <button onclick={writeCustom}>Overwrite</button>
          <button onclick={cancelCustomOverwrite}>Cancel</button>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .behavior-wizard {
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
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 16rem;
    max-height: 20rem;
    overflow-y: auto;
  }

  .list-panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid #444;
  }

  .row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
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

  .row .meta {
    color: #888;
    font-size: 0.75rem;
  }

  .detail-panel {
    flex: 1;
    min-width: 20rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .custom-scaffold {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    max-width: 30rem;
  }

  h4 {
    margin: 0.4rem 0 0;
    font-size: 0.9rem;
    color: #ddd;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .scope-field {
    gap: 0.75rem;
    font-size: 0.85rem;
    color: #ddd;
  }

  .key {
    min-width: 8ch;
    color: #ddd;
  }

  select,
  input[type='text'] {
    font-family: inherit;
    font-size: 0.85rem;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #ddd;
  }

  .step-label {
    color: #6ab0ff;
    min-width: 8ch;
  }

  .hint {
    color: #888;
  }

  .add-entry {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.4rem;
    padding-top: 0.4rem;
    border-top: 1px solid #444;
  }

  .actions-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  button {
    font-family: inherit;
  }

  .empty {
    color: #888;
    margin: 0.25rem 0;
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
