import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const testFiles = [
  'legal-safe-mode.test.mjs',
  'atomic-team-import.test.mjs',
  'security-hardening.test.mjs',
  'js/features/draft/draftLogic.test.mjs',
  'js/features/teams/teamStats.test.mjs',
  'js/features/teams/teamImportValidation.test.mjs',
  'js/features/teams/teamValidation.test.mjs',
];

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScript(path));
    else if (extname(entry.name) === '.js') files.push(path);
  }
  return files;
}

function run(args, label) {
  const result = spawnSync(process.execPath, args, { cwd: rootPath, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${label} fehlgeschlagen.`);
}

for (const file of await collectJavaScript(fileURLToPath(new URL('../js/', import.meta.url)))) {
  run(['--check', file], `Syntaxprüfung ${relative(rootPath, file)}`);
}
for (const file of testFiles) run([file], `Test ${file}`);
console.log(`check: OK (${testFiles.length} Tests plus JavaScript-Syntax)`);
