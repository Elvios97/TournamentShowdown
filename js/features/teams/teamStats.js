export const STAT_KEYS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

const BASE_COLUMNS = {
  HP: 'base_hp',
  Atk: 'base_atk',
  Def: 'base_def',
  SpA: 'base_spa',
  SpD: 'base_spd',
  Spe: 'base_spe',
};

const NATURES = {
  adamant: ['Atk', 'SpA'], hart: ['Atk', 'SpA'],
  bashful: [null, null], zaghaft: [null, null],
  bold: ['Def', 'Atk'], kühn: ['Def', 'Atk'], kuehn: ['Def', 'Atk'],
  brave: ['Atk', 'Spe'], mutig: ['Atk', 'Spe'],
  calm: ['SpD', 'Atk'], still: ['SpD', 'Atk'],
  careful: ['SpD', 'SpA'], sacht: ['SpD', 'SpA'],
  docile: [null, null], sanft: [null, null],
  gentle: ['SpD', 'Def'], zart: ['SpD', 'Def'],
  hardy: [null, null], robust: [null, null],
  hasty: ['Spe', 'Def'], hastig: ['Spe', 'Def'],
  impish: ['Def', 'SpA'], pfiffig: ['Def', 'SpA'],
  jolly: ['Spe', 'SpA'], froh: ['Spe', 'SpA'],
  lax: ['Def', 'SpD'], lasch: ['Def', 'SpD'],
  lonely: ['Atk', 'Def'], solo: ['Atk', 'Def'],
  mild: ['SpA', 'Def'], mildes: ['SpA', 'Def'], mild: ['SpA', 'Def'],
  modest: ['SpA', 'Atk'], mäßig: ['SpA', 'Atk'], maessig: ['SpA', 'Atk'],
  naive: ['Spe', 'SpD'], naiv: ['Spe', 'SpD'],
  naughty: ['Atk', 'SpD'], frech: ['Atk', 'SpD'],
  quiet: ['SpA', 'Spe'], ruhig: ['SpA', 'Spe'],
  quirky: [null, null], kauzig: [null, null],
  rash: ['SpA', 'SpD'], hitzig: ['SpA', 'SpD'],
  relaxed: ['Def', 'Spe'], locker: ['Def', 'Spe'],
  sassy: ['SpD', 'Spe'], forsch: ['SpD', 'Spe'],
  serious: [null, null], ernst: [null, null],
  timid: ['Spe', 'Atk'], scheu: ['Spe', 'Atk'],
};

export function normalizeStatSpread(spread = {}, max = 252, fallback = 0) {
  const result = {};
  for (const key of STAT_KEYS) {
    const value = Number(spread?.[key] ?? fallback);
    result[key] = Number.isInteger(value) && value >= 0 ? Math.min(value, max) : fallback;
  }
  return result;
}

export function championsPointsToEv(points) {
  const value = Math.max(0, Math.min(32, Number(points) || 0));
  return Math.round(value / 32 * 252);
}

export function getBaseStats(entry = null) {
  if (!entry) return null;
  const stats = {};
  for (const key of STAT_KEYS) {
    const value = Number(entry[BASE_COLUMNS[key]]);
    if (!Number.isFinite(value) || value <= 0) return null;
    stats[key] = value;
  }
  return stats;
}

export function natureModifier(nature, stat) {
  const key = String(nature || '').trim().toLocaleLowerCase('de-DE');
  const [up, down] = NATURES[key] || [null, null];
  if (up === stat && down !== stat) return 1.1;
  if (down === stat && up !== stat) return 0.9;
  return 1;
}

export function calculatePokemonStats(mon = {}, catalogEntry = null, options = {}) {
  const base = getBaseStats(catalogEntry);
  if (!base) return null;

  const mode = options.mode || 'standard';
  const level = mode === 'champions' ? 50 : Math.max(1, Math.min(100, Number(mon.level) || Number(options.level) || 50));
  const evs = mode === 'champions'
    ? Object.fromEntries(STAT_KEYS.map(key => [key, championsPointsToEv(mon.dvs?.[key])]))
    : normalizeStatSpread(mon.evs, 252, 0);
  const ivs = mode === 'champions'
    ? Object.fromEntries(STAT_KEYS.map(key => [key, 31]))
    : normalizeStatSpread(mon.ivs, 31, 31);

  const result = {};
  for (const key of STAT_KEYS) {
    const raw = Math.floor(((2 * base[key] + ivs[key] + Math.floor(evs[key] / 4)) * level) / 100);
    if (key === 'HP') result[key] = raw + level + 10;
    else result[key] = Math.floor((raw + 5) * natureModifier(mon.nature, key));
  }
  return result;
}

export function speedOrder(pokemonList = [], catalogByPokemonId = new Map(), options = {}) {
  return pokemonList
    .map(mon => {
      const catalogEntry = catalogByPokemonId.get(mon.form_pokemon_id) || catalogByPokemonId.get(mon.pokemon_id);
      const stats = calculatePokemonStats(mon, catalogEntry, options);
      return {
        id: mon.id || mon.pokemon_id,
        pokemonName: mon.pokemon_name || catalogEntry?.pokemon_name || 'Pokémon',
        formName: catalogEntry?.pokemon_name || mon.pokemon_name || '',
        speed: stats?.Spe ?? null,
        stats,
      };
    })
    .sort((a, b) => (b.speed ?? -1) - (a.speed ?? -1) || a.pokemonName.localeCompare(b.pokemonName, 'de'));
}

export function validateChampionsDvs(dvs = {}) {
  for (const key of STAT_KEYS) {
    const value = Number(dvs?.[key] || 0);
    if (!Number.isInteger(value) || value < 0 || value > 32) return false;
  }
  return true;
}
