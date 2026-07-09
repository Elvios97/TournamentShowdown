import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./teamImportValidation.js', import.meta.url), 'utf8');
const { normalizeImportedTeam, assertImportFileSize } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const valid = normalizeImportedTeam([{ name: 'Pikachu', moves: ['Thunderbolt'], evs: { Spe: 252, SpA: 252, HP: 4 } }]);
assert.equal(valid[0].pokemon_id, 'pikachu');
assert.equal(valid[0].evs.Spe, 252);
assert.throws(() => normalizeImportedTeam([]), /keine Pokémon/);
assert.throws(() => normalizeImportedTeam([{ name: 'X', moves: ['1','2','3','4','5'] }]), /vier Moves/);
assert.throws(() => normalizeImportedTeam([{ name: 'X', moves: 'Thunderbolt' }]), /Liste/);
assert.throws(() => normalizeImportedTeam([{ name: 'X', moves: [''] }]), /leer/);
assert.throws(() => normalizeImportedTeam([{ name: 'X', evs: { HP: 253 } }]), /zwischen 0 und 252/);
assert.throws(() => normalizeImportedTeam([{ name: 'X', evs: { HP: 252, Atk: 252, Def: 252 } }]), /510/);
assert.throws(() => normalizeImportedTeam([{ name: 'X', evs: { Speed: 252 } }]), /Unbekannter EV-Wert/);
assert.throws(() => assertImportFileSize({ size: 1_000_001 }), /1 MB/);
console.log('teamImportValidation: OK');
