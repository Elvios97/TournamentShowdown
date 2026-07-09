import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./teamValidation.js', import.meta.url), 'utf8');
const { validateTeam } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const completeMon = id => ({ id, pokemon_id: id, pokemon_name: id, item: 'Item', ability: 'Ability', nature: 'Froh', moves: ['A', 'B', 'C', 'D'], evs: { HP: 4, Atk: 252, Spe: 252 } });
assert.equal(validateTeam([], null).status, 'error');
assert.equal(validateTeam([completeMon('a')], { team_size: 1, allow_duplicates: false }).status, 'complete');
assert.equal(validateTeam([completeMon('a'), completeMon('a')], { team_size: 2, allow_duplicates: false }).errors, 1);
assert.equal(validateTeam([{ ...completeMon('a'), moves: ['A', 'A', 'B', 'C'] }], { team_size: 1 }).status, 'error');
assert.equal(validateTeam([{ ...completeMon('a'), evs: { Atk: 253 } }], { team_size: 1 }).status, 'error');
const tooManyMoves = validateTeam([{ ...completeMon('a'), moves: ['A', 'B', 'C', 'D', 'E'] }], { team_size: 1 });
assert.ok(tooManyMoves.issues.some(item => item.code === 'moves_large' && item.fix));
const incomplete = validateTeam([completeMon('a')], null);
assert.ok(incomplete.issues.every(item => typeof item.fix === 'string' && item.fix.length > 0));
const oversized = validateTeam([completeMon('a'), completeMon('b')], { team_size: 1, allow_duplicates: true });
assert.match(oversized.issues.find(item => item.code === 'team_large').fix, /Entferne 1 Pokémon/);
assert.ok(validateTeam([{ ...completeMon('a'), pokemon_id: '' }], { team_size: 1 }).issues.some(item => item.code === 'pokemon_identity_missing'));
console.log('teamValidation: OK');
