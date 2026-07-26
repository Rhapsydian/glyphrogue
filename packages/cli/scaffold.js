import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export function kebabCase(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Plain literal token substitution (docs/design/cli.md's "Substitution
// mechanism" decision) - no templating engine, just a fixed token map
// applied via replaceAll to every copied file's text content and name.
export function buildTokenMap(gameName) {
  return {
    __GAME_NAME__: kebabCase(gameName),
    __GAME_TITLE__: gameName,
  };
}

export function substitute(content, tokens) {
  let result = content;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

export async function copyTemplate(sourceDir, targetDir, tokens) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, substitute(entry.name, tokens));
    if (entry.isDirectory()) {
      await copyTemplate(sourcePath, targetPath, tokens);
    } else {
      const content = await readFile(sourcePath, 'utf8');
      await writeFile(targetPath, substitute(content, tokens));
    }
  }
}

export async function targetDirIsUsable(targetDir) {
  try {
    const info = await stat(targetDir);
    if (!info.isDirectory()) return false;
    const contents = await readdir(targetDir);
    return contents.length === 0;
  } catch {
    // Doesn't exist yet - the normal case, fine to create.
    return true;
  }
}
