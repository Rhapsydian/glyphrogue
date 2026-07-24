// Node-only, dev-server-side code - never bundled into a browser build
// (unlike mount.js/hotReload.js). Registered in a Vite config's own
// `plugins` array, by this package's own `dev/` fixture and by a real
// downstream game's vite.config.js alike (editor.md's shared file-write
// API: a browser tab can't touch the filesystem directly, so every
// write-capable tool in this doc routes through dev-server middleware).
import { access, cp, readdir, readFile, stat } from 'node:fs/promises';
import { basename, resolve, relative, sep, posix } from 'node:path';
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

// Plugin discovery (editor.md's "Plugin management"): a lightweight,
// best-effort text scan of a bootstrap file's source - not a real AST
// parser, same "no marker-comment convention, no AST parser" posture the
// file-write API's write side already commits to. Two things worth
// tracking: named imports from '@glyphrogue/core' (core-bundled plugins,
// cross-referenced by export name) and default imports from any other
// path (author-authored plugins live one-per-file with a default export,
// per plugins.js's module-format comment - cross-referenced by source
// path against a discovered src/plugins/<id>/ candidate).
const IMPORT_STATEMENT_RE = /import\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g;
const LOAD_PLUGINS_ARRAY_RE = /loadPlugins\s*\([^,]*,\s*\[([^\]]*)\]/;

function splitList(raw) {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseBootstrapSource(source) {
  const coreImportNames = [];
  const authorImports = [];

  for (const match of source.matchAll(IMPORT_STATEMENT_RE)) {
    const [, clause, sourcePath] = match;
    if (clause.startsWith('{')) {
      if (sourcePath !== '@glyphrogue/core') continue;
      coreImportNames.push(
        ...splitList(clause.slice(1, -1)).map((entry) => {
          const parts = entry.split(/\s+as\s+/);
          return parts[parts.length - 1].trim();
        }),
      );
    } else {
      authorImports.push({ localName: clause, sourcePath });
    }
  }

  const arrayMatch = LOAD_PLUGINS_ARRAY_RE.exec(source);
  const loadPluginsArrayEntries = arrayMatch ? splitList(arrayMatch[1]) : [];

  return { coreImportNames, authorImports, loadPluginsArrayEntries };
}

async function readBootstrapSource(bootstrapPath) {
  if (!bootstrapPath) return '';
  try {
    return await readFile(bootstrapPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

// Candidate author-authored plugin folders (editor.md's folder-per-plugin
// convention: src/plugins/<pluginId>/, an entry module plus any assets it
// needs). Absent entirely - no src/plugins/ directory yet - is a normal,
// non-error state (a fresh project before any author plugin exists), same
// "not a hard error" posture getGitStatusEntries already takes.
async function discoverAuthorPluginFolders(projectRoot) {
  const pluginsDir = resolve(projectRoot, 'src/plugins');
  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// Author-to-author import/export (editor.md: "plain filesystem copy/zip,
// not a real package/npm artifact"). A destination folder name (import) or
// a `pluginId` (export) both ultimately become a path segment under
// src/plugins/ - this guards against a crafted `../` escaping it, same
// hygiene level as resolveContainedPath above.
const PLUGIN_ID_RE = /^[A-Za-z0-9_-]+$/;

export function isValidPluginId(id) {
  return typeof id === 'string' && PLUGIN_ID_RE.test(id);
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// A browser tab dynamically imports a candidate plugin module by URL, not
// filesystem path - and the file-write API's own `projectRoot` isn't
// necessarily Vite's serving root (this package's own dev fixture points
// `projectRoot` at dev/sandbox, a subdirectory of the package Vite actually
// serves). `viteRoot` is Vite's own `server.config.root`, always correct
// regardless of that relationship.
function toModuleUrl(viteRoot, absolutePath) {
  return `/${relative(viteRoot, absolutePath).split(sep).join(posix.sep)}`;
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
// convention). `bootstrapPath` (optional, resolved against `projectRoot`
// if relative) is the game's own hand-authored bootstrap file plugin
// management reads to derive enabled state - absent entirely when a
// consumer isn't using plugin management yet.
export function createFileWriteApi({ projectRoot = process.cwd(), bootstrapPath } = {}) {
  const provenance = createProvenanceStore();
  const resolvedBootstrapPath = bootstrapPath ? resolve(projectRoot, bootstrapPath) : undefined;

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

      // Two-source discovery (editor.md): author-authored candidate
      // folders from a directory scan, plus the bootstrap file's parsed
      // import/loadPlugins-array state. Returns already-parsed structured
      // data, never raw source - devServerPlugin.js is Node-only and can't
      // be imported by the browser tab that needs to combine this with
      // per-candidate kind derivation (session 29's storage.js lesson).
      server.middlewares.use('/__glyphrogue_editor/plugins/discover', async (req, res) => {
        const viteRoot = server.config.root;
        const folderNames = await discoverAuthorPluginFolders(projectRoot);
        const candidates = folderNames.map((id) => ({
          id,
          url: toModuleUrl(viteRoot, resolve(projectRoot, 'src/plugins', id, 'index.js')),
        }));
        const bootstrap = parseBootstrapSource(await readBootstrapSource(resolvedBootstrapPath));

        sendJson(res, 200, { candidates, bootstrap });
      });

      // Import: an author copies a plugin folder they received into
      // src/plugins/ (editor.md's "Services"/"Plugin management" import/
      // export section). `sourcePath` is wherever on the author's own
      // machine they saved it - not constrained to projectRoot, unlike a
      // write destination, since bringing in a folder from outside the
      // project is the entire point. The destination id is the source
      // folder's own basename, matching the folder-per-plugin convention.
      server.middlewares.use('/__glyphrogue_editor/plugins/import', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'expected POST' });
          return;
        }
        try {
          const { sourcePath } = await readJsonBody(req);
          if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
            throw new Error('expected a non-empty string "sourcePath"');
          }

          const resolvedSource = resolve(sourcePath);
          if (!(await isDirectory(resolvedSource))) {
            throw new Error(`"${sourcePath}" is not a directory`);
          }

          const id = basename(resolvedSource);
          if (!isValidPluginId(id)) {
            throw new Error(`"${id}" isn't a valid plugin id (folder name) - use letters, digits, "-", "_" only`);
          }

          const destination = resolve(projectRoot, 'src/plugins', id);
          if (await fileExists(destination)) {
            throw new Error(`a plugin folder named "${id}" already exists in src/plugins/`);
          }

          await cp(resolvedSource, destination, { recursive: true, errorOnExist: true });
          provenance.record(relative(projectRoot, destination), {
            tool: 'plugin-import',
            label: `imported plugin: ${id}`,
          });

          sendJson(res, 200, { ok: true, id });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message });
        }
      });

      // Export: packages one of this project's own src/plugins/<id>/
      // folders for handing to another author - a plain filesystem copy to
      // wherever they ask (editor.md: "plain filesystem copy/zip, not a
      // real package/npm artifact"), same posture as import above.
      server.middlewares.use('/__glyphrogue_editor/plugins/export', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'expected POST' });
          return;
        }
        try {
          const { pluginId, destinationPath } = await readJsonBody(req);
          if (!isValidPluginId(pluginId)) {
            throw new Error(`"${pluginId}" isn't a valid plugin id`);
          }
          if (typeof destinationPath !== 'string' || destinationPath.length === 0) {
            throw new Error('expected a non-empty string "destinationPath"');
          }

          const source = resolveContainedPath(resolve(projectRoot, 'src/plugins'), pluginId);
          if (!(await isDirectory(source))) {
            throw new Error(`no plugin folder "${pluginId}" found in src/plugins/`);
          }

          const resolvedDestination = resolve(destinationPath);
          if (await fileExists(resolvedDestination)) {
            throw new Error(`"${destinationPath}" already exists`);
          }

          await cp(source, resolvedDestination, { recursive: true, errorOnExist: true });

          sendJson(res, 200, { ok: true, path: resolvedDestination });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message });
        }
      });
    },
  };
}
