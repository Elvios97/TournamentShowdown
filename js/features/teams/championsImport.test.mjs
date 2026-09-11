import assert from 'node:assert/strict';
import { parseShowdown } from '../../showdownParser.js';
import { championsDvsForImport, showdownEvsToChampionsDvs } from './championsImport.js';

assert.deepEqual(
  showdownEvsToChampionsDvs({ HP: 252, Atk: 0, Def: 4, SpA: 252, SpD: 0, Spe: 0 }),
  { HP: 32, Atk: 0, Def: 1, SpA: 32, SpD: 0, Spe: 0 },
);

assert.deepEqual(
  showdownEvsToChampionsDvs({ HP: 32, Atk: 0, Def: 1, SpA: 32, SpD: 0, Spe: 32 }),
  { HP: 32, Atk: 0, Def: 1, SpA: 32, SpD: 0, Spe: 32 },
);

assert.deepEqual(
  showdownEvsToChampionsDvs({ HP: 36, Atk: 0, Def: 0, SpA: 252, SpD: 0, Spe: 220 }),
  { HP: 5, Atk: 0, Def: 0, SpA: 32, SpD: 0, Spe: 28 },
);

const parsed = parseShowdown(`Eelektross @ Eelektrossite
Ability: Levitate
EVs: 88 Def / 140 SpA / 252 Spe
Mild Nature

Ninetales @ Leftovers
Ability: Drought
Modest Nature
# Champions stat points: HP 32 / Def 15 / SpA 4 / SpD 15
- Heat Wave
- Snarl
- Will-O-Wisp
- Protect`);

assert.equal(parsed.length, 2);
assert.deepEqual(
  championsDvsForImport(parsed[0]),
  { HP: 0, Atk: 0, Def: 11, SpA: 18, SpD: 0, Spe: 32 },
);
assert.deepEqual(
  championsDvsForImport(parsed[1]),
  { HP: 32, Atk: 0, Def: 15, SpA: 4, SpD: 15, Spe: 0 },
);

console.log('championsImport: OK');
