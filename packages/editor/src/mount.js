import { mount } from 'svelte';
import App from './App.svelte';

// The one entry point a consuming game calls. `api` is whatever live
// `createApi()` instance the game already built (editor.md: `core` is a
// peerDependency, never constructed by this package itself). Returns
// Svelte 5's component instance so a caller could `unmount()` it later if
// ever needed, though no consumer does that yet.
export function mountEditor(container, api) {
  return mount(App, { target: container, props: { api } });
}
