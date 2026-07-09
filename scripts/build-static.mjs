import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const outputDir = resolve(projectRoot, 'dist');
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
const basePath = String(process.env.BASE_PATH || '').trim();

function fail(message) {
  console.error(`Build abgebrochen: ${message}`);
  process.exit(1);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) fail('SUPABASE_URL fehlt oder ist ungültig.');
if (!supabaseAnonKey || /YOUR-|service[_-]?role/i.test(supabaseAnonKey)) fail('SUPABASE_ANON_KEY fehlt oder ist unsicher.');
if (basePath && !/^\/[a-z0-9/_-]*$/i.test(basePath)) fail('BASE_PATH muss leer sein oder mit / beginnen.');

const jwtParts = supabaseAnonKey.split('.');
if (jwtParts.length >= 2) {
  try {
    const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'));
    if (payload.role === 'service_role') fail('Ein service_role-Key darf niemals ins Frontend gebaut werden.');
  } catch (error) {
    if (error?.message?.startsWith('Build abgebrochen')) throw error;
  }
}

await mkdir(outputDir, { recursive: true });
try {
  const oldEntries = await readdir(outputDir);
  await Promise.all(oldEntries.map(entry => rm(resolve(outputDir, entry), { recursive: true, force: true })));
} catch (error) {
  if (error?.code === 'EBUSY' || error?.code === 'EPERM') {
    fail('Eine Datei in dist/ wird noch verwendet. Beende den zugehörigen Server oder Datei-Explorer und starte den Build erneut.');
  }
  throw error;
}
await mkdir(resolve(outputDir, 'js'), { recursive: true });
await Promise.all([
  cp(resolve(projectRoot, 'index.html'), resolve(outputDir, 'index.html')),
  cp(resolve(projectRoot, 'styles.css'), resolve(outputDir, 'styles.css')),
  cp(resolve(projectRoot, 'js'), resolve(outputDir, 'js'), {
    recursive: true,
    filter: source => !source.endsWith('.test.mjs'),
  }),
]);

const config = `// Automatisch durch scripts/build-static.mjs erzeugt.\nexport const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};\nexport const BASE_PATH = ${JSON.stringify(basePath)};\n`;
await writeFile(resolve(outputDir, 'js', 'config.js'), config, 'utf8');
console.log('Statischer Build erfolgreich: dist/');
