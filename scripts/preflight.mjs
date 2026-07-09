import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const requiredFiles = [
  'README.md', 'DEPLOYMENT.md', 'SECURITY.md', 'LEGAL.md', 'PUBLIC_BETA_TESTING.md',
  '.env.example', 'SUPABASE_SCHEMA.sql', 'SUPABASE_PUBLIC_BETA_HARDENING.sql',
  'SUPABASE_ATOMIC_TEAM_IMPORT.sql', 'SUPABASE_RPC_EXECUTE_HARDENING.sql',
];
const forbiddenExtensions = new Set(['.sql', '.md', '.bak', '.env']);

function run(script, label) {
  const result = spawnSync(process.execPath, [script], { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${label} fehlgeschlagen.`);
}

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else files.push(path);
  }
  return files;
}

for (const file of requiredFiles) await readFile(join(root, file));
run('scripts/check.mjs', 'Tests und Syntaxprüfung');
run('scripts/build-static.mjs', 'Deployment-Build');

const files = await collect(dist);
if (!files.length) throw new Error('Der Deployment-Build ist leer.');
for (const file of files) {
  const name = relative(dist, file);
  if (forbiddenExtensions.has(extname(file)) || name.endsWith('.test.mjs')) {
    throw new Error(`Nicht erlaubte Datei im Deployment: ${name}`);
  }
}

const [index, config] = await Promise.all([
  readFile(join(dist, 'index.html'), 'utf8'),
  readFile(join(dist, 'js', 'config.js'), 'utf8'),
]);
if (!index.includes('This is an unofficial fan-made tool')) throw new Error('Fanprojekt-Hinweis fehlt im Build.');
if (/YOUR-|service[_-]?role|sb_secret_/i.test(config)) throw new Error('Unsichere oder unvollständige Deployment-Konfiguration.');

if (process.env.PREFLIGHT_NETWORK === '1') {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_ANON_KEY || '');
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!response.ok) throw new Error(`Supabase ist nicht erreichbar (${response.status}).`);
  console.log('Supabase-Erreichbarkeit: OK');
}

console.log(`preflight: OK (${files.length} Deployment-Dateien)`);
console.log('Noch manuell erforderlich: Migrationen bestätigen und Mehrspieler-Beta-Test abzeichnen.');
