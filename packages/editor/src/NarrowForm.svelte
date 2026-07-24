<script>
  // The narrow shared form primitive (docs/design/editor.md: "Narrow
  // shared form primitive") - deliberately scoped to only the flat
  // { key: defaultValue } shape (map editor params, audio mixing), not a
  // general schema-driven form; keybindings/palette/tileset calibration
  // stay individually-built per that section's own analysis. Controlled
  // component: never mutates `values` itself, always reports edits via
  // onChange(key, newValue) and lets the parent own state - same
  // callback-up pattern PluginList/PluginServices already use.
  import { buildFieldSpecs } from './narrowForm.js';

  let { defaults, values, onChange } = $props();

  let fields = $derived(buildFieldSpecs(defaults));

  function currentValue(field) {
    return values[field.key] ?? field.defaultValue;
  }

  function handleInput(field, event) {
    const raw = field.type === 'boolean' ? event.target.checked : event.target.value;
    const next = field.type === 'number' ? Number(raw) : raw;
    onChange(field.key, next);
  }
</script>

<div class="narrow-form">
  {#each fields as field (field.key)}
    <label class="field">
      <span class="key">{field.key}</span>
      {#if field.type === 'boolean'}
        <input type="checkbox" checked={currentValue(field)} onchange={(e) => handleInput(field, e)} />
      {:else if field.type === 'number'}
        <input type="number" value={currentValue(field)} oninput={(e) => handleInput(field, e)} />
      {:else}
        <input type="text" value={currentValue(field)} oninput={(e) => handleInput(field, e)} />
      {/if}
    </label>
  {/each}
</div>

<style>
  .narrow-form {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .key {
    min-width: 14ch;
    color: #ddd;
  }

  input[type='number'],
  input[type='text'] {
    font-family: inherit;
    font-size: 0.85rem;
    width: 8ch;
    background: #262626;
    color: #ddd;
    border: 1px solid #444;
  }
</style>
