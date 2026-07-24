import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createFileWriteApi } from './src/devServerPlugin.js';

const packageDir = dirname(fileURLToPath(import.meta.url));

// `vite build` produces the published library (dist/mount.js); `vite`/`vite
// dev` serves `dev/dev.html` as a normal page for manual harness testing
// (dev-session skill's browser-verification step) - same plugin config
// either way, only the `build.lib` entry is build-command-specific.
export default defineConfig(({ command }) => ({
  plugins: [
    // css: 'injected' keeps dist/mount.js a single self-contained file
    // (styles applied via JS at runtime) rather than a second
    // dist/mount.css a consumer would have to remember to import
    // separately.
    svelte({ compilerOptions: { css: 'injected' } }),
    // Only needed for this package's own dev fixture's manual
    // verification (checkpoint 4/5) - a real downstream game registers
    // this same plugin from '@glyphrogue/editor/devServerPlugin' in its
    // own vite.config.js, pointed at its actual project root instead of
    // this scratch sandbox. `bootstrapPath` points plugin management's
    // discovery at dev/sandbox/bootstrap.js, a stand-in for a real game's
    // own hand-authored bootstrap file (dev/main.js can't double as this -
    // it mounts the editor itself).
    createFileWriteApi({ projectRoot: resolve(packageDir, 'dev/sandbox'), bootstrapPath: 'bootstrap.js' }),
  ],
  build: command === 'build' ? {
    lib: {
      entry: {
        mount: 'src/mount.js',
        hotReload: 'src/hotReload.js',
        devServerPlugin: 'src/devServerPlugin.js',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        // Never bundled: a peerDependency precisely so a downstream
        // game's own live api/world is the only instance in play
        // (editor.md) - bundling hotReload.js's/devServerPlugin.js's
        // `@glyphrogue/core` imports here would ship a second copy.
        '@glyphrogue/core',
        // devServerPlugin.js is Node-only dev-server code, never loaded in
        // a browser - explicitly externalizing its node: imports keeps
        // them as plain imports in the output. Without this they'd get
        // the same browser-safety-net stub treatment this build step
        // applies by default (the exact crash storage.js hit in
        // checkpoint 2), even though nothing here is ever browser-loaded.
        'node:fs/promises',
        'node:path',
        'node:child_process',
        'node:util',
      ],
    },
  } : undefined,
}));
