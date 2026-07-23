import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// `vite build` produces the published library (dist/mount.js); `vite`/`vite
// dev` serves `dev/dev.html` as a normal page for manual harness testing
// (dev-session skill's browser-verification step) - same plugin config
// either way, only the `build.lib` entry is build-command-specific.
export default defineConfig(({ command }) => ({
  // css: 'injected' keeps dist/mount.js a single self-contained file (styles
  // applied via JS at runtime) rather than a second dist/mount.css a
  // consumer would have to remember to import separately.
  plugins: [svelte({ compilerOptions: { css: 'injected' } })],
  build: command === 'build' ? {
    lib: {
      entry: {
        mount: 'src/mount.js',
        hotReload: 'src/hotReload.js',
      },
      formats: ['es'],
    },
    rollupOptions: {
      // @glyphrogue/core stays external (never bundled): it's a
      // peerDependency precisely so a downstream game's own live api/world
      // is the only instance in play (editor.md) - bundling hotReload.js's
      // `serialize`/`deserialize` imports here would ship a second copy.
      external: ['@glyphrogue/core'],
    },
  } : undefined,
}));
