// Node-only, dev-server-side code - never bundled into a browser build
// (unlike mount.js/hotReload.js). Registered in a Vite config's own
// `plugins` array, by this package's own `dev/` fixture and by a real
// downstream game's vite.config.js alike (editor.md's shared file-write
// API: a browser tab can't touch the filesystem directly, so every
// write-capable tool in this doc routes through dev-server middleware).
import { access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileAtomic } from '@glyphrogue/core';

const execAsync = promisify(exec);

// Cheap hygiene, not a real threat-model response (editor.md) - this only
// ever runs against a local, dev-only server, never shipped. Resolves
// `requestedPath` against `projectRoot` and throws if the result would
// land outside it (e.g. a `../../` escape).
export function resolveContainedPath(projectRoot, requestedPath) {
  const resolvedRoot = resolve(projectRoot);
  const resolvedPath = resolve(resolvedRoot, requestedPath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + sep)) {
    throw new Error(`path "${requestedPath}" escapes the project root`);
  }
  return resolvedPath;
}

// Validates/normalizes an already-JSON-parsed request body. `path` and
// `content` are required (editor.md's `{ path, content, tool, label }`
// shape); `tool`/`label` are the touched-files log's provenance
// annotation and stay optional here - a caller not participating in that
// log can still just write a file.
export function parseWriteRequest(body) {
  if (!body || typeof body.path !== 'string' || typeof body.content !== 'string') {
    throw new Error('write request must include string "path" and "content" fields');
  }
  return {
    path: body.path,
    content: body.content,
    tool: typeof body.tool === 'string' ? body.tool : undefined,
    label: typeof body.label === 'string' ? body.label : undefined,
  };
}

// Per-path provenance, kept for the lifetime of the dev-server process
// only - purely decoration on top of what git/filesystem already
// independently confirm exists (editor.md's touched-files log, checkpoint
// 5). Not persisted, not a source of truth for anything.
export function createProvenanceStore() {
  const entries = new Map();
  return {
    record(path, { tool, label } = {}) {
      entries.set(path, { tool, label, recordedAt: Date.now() });
    },
    list() {
      return [...entries].map(([path, info]) => ({ path, ...info }));
    },
  };
}

// Pure parser for `git status --porcelain` output - one line per changed
// path, `XY<space>path` (XY is the two-character status code). Exported
// and unit-tested directly; the actual `git status` child-process
// invocation below is exercised via manual verification instead, same
// split as the write/exists endpoints above.
export function parseGitStatusPorcelain(output) {
  return output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }));
}

async function getGitStatusEntries(projectRoot) {
  try {
    // --untracked-files=all: without it, git collapses an entirely-new
    // directory to one summary line (e.g. `?? src/`) instead of listing
    // the files inside it - since provenance is recorded per exact file
    // path, a collapsed directory entry would never match up and the
    // label would silently fail to show.
    const { stdout } = await execAsync('git status --porcelain --untracked-files=all', { cwd: projectRoot });
    return parseGitStatusPorcelain(stdout);
  } catch {
    // Not a git repo, git not installed, or some other git failure - the
    // touched-files log just has nothing to derive from, not a hard error
    // (editor.md: derived from live state, no independent source of truth
    // to fall back on when that state isn't available).
    return [];
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

// The Vite plugin: adds the write/exists dev-server middleware every
// write-capable editor.md tool routes through. `projectRoot` defaults to
// the Vite config's own directory (`process.cwd()` when a game runs
// `vite`/`vite dev` from its project root, same as any other Vite config
// convention).
export function createFileWriteApi({ projectRoot = process.cwd() } = {}) {
  const provenance = createProvenanceStore();

  return {
    name: 'glyphrogue-editor-file-write-api',
    configureServer(server) {
      server.middlewares.use('/__glyphrogue_editor/write', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'expected POST' });
          return;
        }
        try {
          const request = parseWriteRequest(await readJsonBody(req));
          const absolutePath = resolveContainedPath(projectRoot, request.path);

          await writeFileAtomic(absolutePath, request.content);
          provenance.record(request.path, { tool: request.tool, label: request.label });

          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message });
        }
      });

      server.middlewares.use('/__glyphrogue_editor/exists', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const requestedPath = url.searchParams.get('path');
          if (typeof requestedPath !== 'string') {
            throw new Error('expected a "path" query parameter');
          }

          const absolutePath = resolveContainedPath(projectRoot, requestedPath);
          sendJson(res, 200, { exists: await fileExists(absolutePath) });
        } catch (error) {
          sendJson(res, 400, { exists: false, error: error.message });
        }
      });

      // Derived from live git state, not an independently-maintained
      // ledger (editor.md) - git status is the source of truth for "what's
      // actually changed on disk right now"; provenance is purely
      // decoration layered on top. A path with provenance that git no
      // longer reports (reverted, or the whole file deleted outside the
      // editor) just stops appearing - no stale entries to clean up.
      server.middlewares.use('/__glyphrogue_editor/touched-files', async (req, res) => {
        const gitEntries = await getGitStatusEntries(projectRoot);
        const provenanceByPath = new Map(provenance.list().map((entry) => [entry.path, entry]));

        const touchedFiles = gitEntries.map(({ status, path }) => ({
          path,
          status,
          tool: provenanceByPath.get(path)?.tool,
          label: provenanceByPath.get(path)?.label,
        }));

        sendJson(res, 200, { touchedFiles });
      });
    },
  };
}
