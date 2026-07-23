import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Library build only for now (checkpoint 1). Checkpoint 2 adds dev-server
// config for the `dev/` fixture on top of this same file.
export default defineConfig({
  // css: 'injected' keeps dist/mount.js a single self-contained file (styles
  // applied via JS at runtime) rather than a second dist/mount.css a
  // consumer would have to remember to import separately.
  plugins: [svelte({ compilerOptions: { css: 'injected' } })],
  build: {
    lib: {
      entry: 'src/mount.js',
      formats: ['es'],
      fileName: 'mount',
    },
  },
});
