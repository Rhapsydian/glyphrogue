import { createApi } from '@glyphrogue/core';
import { registerPlugins } from '../bootstrap.js';
import { instantiateZoneContent, renderZone } from './game.js';

const api = createApi();
registerPlugins(api);
instantiateZoneContent(api);
renderZone(document.getElementById('game'));

// Handy for poking at the live world from devtools during local testing.
window.__game = api;
