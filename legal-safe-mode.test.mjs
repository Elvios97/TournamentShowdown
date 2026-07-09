import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, legal, login, publicTeam] = await Promise.all([
  readFile(new URL('./index.html', import.meta.url), 'utf8'),
  readFile(new URL('./LEGAL.md', import.meta.url), 'utf8'),
  readFile(new URL('./js/ui/login.js', import.meta.url), 'utf8'),
  readFile(new URL('./js/features/publicTeams/publicTeamView.js', import.meta.url), 'utf8'),
]);

const disclaimer = 'This is an unofficial fan-made tool and is not affiliated with, endorsed, sponsored, or approved by Nintendo, Game Freak, Creatures Inc., or The Pokémon Company.';
assert.ok(index.includes(disclaimer), 'Globaler Fanprojekt-Hinweis fehlt');
assert.ok(legal.includes(disclaimer), 'Rechtlicher Hinweis fehlt in LEGAL.md');
assert.match(login, /Unofficial fan-made tool/);
assert.match(publicTeam, /Unofficial fan-made tool/);
assert.doesNotMatch(index, /<img[^>]+(?:pokemon|nintendo|game.?freak)[^>]+logo/i);
console.log('legal-safe-mode: OK');
