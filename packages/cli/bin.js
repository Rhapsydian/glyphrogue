#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, cwd } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { buildTokenMap, copyTemplate, targetDirIsUsable } from './scaffold.js';

const packageDir = dirname(fileURLToPath(import.meta.url));
const templateDir = resolve(packageDir, 'templates/default');

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const gameName = (await rl.question('Game name: ')).trim();
  rl.close();

  if (!gameName) {
    console.error('A game name is required.');
    process.exitCode = 1;
    return;
  }

  const tokens = buildTokenMap(gameName);
  const targetDir = resolve(cwd(), tokens.__GAME_NAME__);

  if (!(await targetDirIsUsable(targetDir))) {
    console.error(`Directory "${relative(cwd(), targetDir)}" already exists and is not empty.`);
    process.exitCode = 1;
    return;
  }

  await copyTemplate(templateDir, targetDir, tokens);

  console.log(`\nCreated ${tokens.__GAME_NAME__} in ${targetDir}\n`);
  console.log('Next steps:');
  console.log(`  cd ${relative(cwd(), targetDir)}`);
  console.log('  npm install');
  console.log('  npm run dev');
}

main();
