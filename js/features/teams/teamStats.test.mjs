import assert from 'node:assert/strict';
import {
  calculatePokemonStats,
  championsPointsToEv,
  speedOrder,
  validateChampionsDvs,
} from './teamStats.js';

const charizard = {
  pokemon_id: 'charizard',
  pokemon_name: 'Charizard',
  base_hp: 78,
  base_atk: 84,
  base_def: 78,
  base_spa: 109,
  base_spd: 85,
  base_spe: 100,
};

assert.equal(championsPointsToEv(0), 0);
assert.equal(championsPointsToEv(32), 252);
assert.equal(championsPointsToEv(16), 126);

const standard = calculatePokemonStats({
  pokemon_id: 'charizard',
  evs: { SpA: 252, Spe: 252, HP: 4 },
  ivs: { HP: 31, Atk: 31, Def: 31, SpA: 31, SpD: 31, Spe: 31 },
  nature: 'Timid',
  level: 50,
}, charizard);
assert.deepEqual(standard, { HP: 154, Atk: 93, Def: 98, SpA: 161, SpD: 105, Spe: 167 });

const champions = calculatePokemonStats({
  pokemon_id: 'charizard',
  dvs: { SpA: 32, Spe: 32, HP: 1 },
  nature: 'Scheu',
}, charizard, { mode: 'champions' });
assert.equal(champions.SpA, 161);
assert.equal(champions.Spe, 167);

assert.equal(validateChampionsDvs({ HP: 32, Atk: 0, Def: 16, SpA: 32, SpD: 1, Spe: 31 }), true);
assert.equal(validateChampionsDvs({ Spe: 33 }), false);

const order = speedOrder([
  { id: 'slow', pokemon_id: 'slow', pokemon_name: 'Slow', evs: {}, ivs: {}, nature: '' },
  { id: 'fast', pokemon_id: 'fast', pokemon_name: 'Fast', evs: { Spe: 252 }, nature: 'Jolly' },
], new Map([
  ['slow', { pokemon_name: 'Slow', base_hp: 80, base_atk: 80, base_def: 80, base_spa: 80, base_spd: 80, base_spe: 20 }],
  ['fast', { pokemon_name: 'Fast', base_hp: 80, base_atk: 80, base_def: 80, base_spa: 80, base_spd: 80, base_spe: 100 }],
]));
assert.equal(order[0].id, 'fast');
