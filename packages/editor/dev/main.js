import { createApi } from '@glyphrogue/core';
import { mountEditor } from '../src/mount.js';

// A minimal real game, not a mock - editor.md's harness operates on
// whatever live api/world a consuming game already built, so the fixture
// has to be a genuine createApi() instance for that to actually be
// exercised (and for checkpoint 3's hot-reload snapshot/restore to have
// real state to preserve).
const api = createApi();

const player = api.createEntity();
api.addComponent(player, 'Position', { x: 2, y: 3 });

const goblin = api.createEntity();
api.addComponent(goblin, 'Position', { x: 5, y: 1 });

function renderGameFixture(container) {
  const rows = [...api.world.entities].map((entity) => {
    const position = api.getComponent(entity, 'Position');
    return `<li>entity ${entity}: ${JSON.stringify(position)}</li>`;
  });
  container.innerHTML = `
    <h1>Glyphrogue dev fixture</h1>
    <p>Sibling region to the right is the editor harness (editor.md: no
    iframe, no overlay - a plain DOM sibling of the game's own UI).</p>
    <ul>${rows.join('')}</ul>
  `;
}

renderGameFixture(document.getElementById('game'));
mountEditor(document.getElementById('editor-root'), api);
