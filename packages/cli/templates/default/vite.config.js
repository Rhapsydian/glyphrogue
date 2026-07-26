import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { defineConfig } from 'vite';
import { createFileWriteApi } from '@glyphrogue/editor/devServerPlugin';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Two-entry dev/prod split (docs/design/build-pipeline.md): index.html
// (the shipped game, imports only @glyphrogue/core) is the only entry a
// production build picks up (Vite's default single-entry behavior, since
// dev.html is never added to build.rollupOptions.input) - dev.html
// (imports @glyphrogue/core *and* @glyphrogue/editor) only gets served by
// the dev server, via `npm run dev`'s --open flag below. base follows the
// same per-mode switch pixelyph established: relative './' for itch.io
// (`vite build --mode itch`), '/__GAME_NAME__/' for GitHub Pages - a
// project repo (the normal case; not a <user>.github.io root repo or a
// custom domain) is served from that subpath, not root '/', or every
// built asset 404s. __GAME_NAME__ matches the repo name this same
// scaffold's README already assumes elsewhere (the itch `butler push`
// line) - rename the repo, update this too.
export default defineConfig(({ mode }) => ({
  base: mode === 'itch' ? './' : '/__GAME_NAME__/',
  plugins: [
    // Powers the map editor / composition tool / plugin management /
    // config UI's file-write API when running against this project's real
    // files. bootstrapPath points plugin management's discovery at this
    // project's own hand-authored bootstrap.js.
    createFileWriteApi({ projectRoot, bootstrapPath: 'bootstrap.js' }),
  ],
}));
