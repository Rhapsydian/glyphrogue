<script>
  // `services` is deriveCatalog's `{ slotId: { core?, author? } }` map -
  // single-slot per editor.md's "Services" section, so at most one of a
  // slot's discovered implementations should read `enabled`.
  // `onSwitch(currentEntry, nextEntry)` mirrors PluginList's `onToggle`:
  // owned by the parent, never writes anything itself.
  let { services, onSwitch } = $props();

  let openSlot = $state(null);

  function currentFiller(slot) {
    return (slot.core?.enabled && slot.core) || (slot.author?.enabled && slot.author) || null;
  }

  function options(slot) {
    return [slot.core, slot.author].filter(Boolean);
  }

  function isCurrent(current, option) {
    return current?.source === option.source && current?.id === option.id;
  }

  function choose(slot, nextEntry) {
    onSwitch(currentFiller(slot), nextEntry);
    openSlot = null;
  }
</script>

<section class="plugin-services">
  <h3>Services</h3>

  {#if Object.keys(services).length === 0}
    <p class="empty">No services discovered.</p>
  {:else}
    <ul>
      {#each Object.entries(services) as [slotId, slot] (slotId)}
        {@const current = currentFiller(slot)}
        <li>
          <div class="row">
            <span class="slot">{slotId}</span>
            <span class="arrow">→</span>
            <span class="filler">{current ? `${current.id} (${current.source})` : '— none —'}</span>
            <button onclick={() => (openSlot = openSlot === slotId ? null : slotId)}>change ▾</button>
          </div>

          {#if openSlot === slotId}
            <ul class="options">
              {#each options(slot) as option (option.source + ':' + option.id)}
                <li>
                  <button onclick={() => choose(slot, option)}>
                    {option.id} ({option.source}){isCurrent(current, option) ? ' ✓' : ''}
                  </button>
                </li>
              {/each}
              <li>
                <button onclick={() => choose(slot, null)}>— none —{current ? '' : ' ✓'}</button>
              </li>
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .plugin-services {
    margin-top: 1rem;
  }

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.9rem;
  }

  .empty {
    color: #888;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.15rem 0;
  }

  .slot {
    min-width: 12ch;
  }

  .arrow {
    color: #888;
  }

  .filler {
    min-width: 16ch;
  }

  .options {
    margin: 0.2rem 0 0.4rem 1.5ch;
    border-left: 1px solid #444;
    padding-left: 0.75rem;
  }

  .options button {
    font-family: inherit;
    font-size: 0.85rem;
    display: block;
    padding: 0.1rem 0;
  }

  button {
    font-family: inherit;
    font-size: 0.85rem;
  }
</style>
