const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POKEAPI = 'https://pokeapi.co/api/v2';
const CURRENT_VERSION_GROUP = process.env.POKEMON_CURRENT_VERSION_GROUP || 'scarlet-violet';
const args = new Set(process.argv.slice(2));

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen für diesen Prozess gesetzt sein.');
  process.exit(1);
}

const title = slug => slug.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
const idFromUrl = url => Number(String(url).match(/\/(\d+)\/$/)?.[1]);
const generationNumber = name => ({
  'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3,
  'generation-iv': 4, 'generation-v': 5, 'generation-vi': 6,
  'generation-vii': 7, 'generation-viii': 8, 'generation-ix': 9,
}[name] || null);
const STAT_COLUMNS = {
  hp: 'base_hp',
  attack: 'base_atk',
  defense: 'base_def',
  'special-attack': 'base_spa',
  'special-defense': 'base_spd',
  speed: 'base_spe',
};
const BATTLE_ITEM_CATEGORIES = new Set([
  'held-items',
  'choice',
  'effort-training',
  'bad-held-items',
  'type-enhancement',
  'species-specific',
  'plates',
  'jewels',
  'mega-stones',
  'memories',
  'z-crystals',
]);

function baseStatsFromPokemon(detail) {
  const stats = {};
  for (const entry of detail.stats || []) {
    const column = STAT_COLUMNS[entry.stat?.name];
    if (column) stats[column] = entry.base_stat;
  }
  return stats;
}

function isMegaPokemon(detail) {
  const name = String(detail.name || '').toLowerCase();
  return name.includes('-mega') || name.endsWith('-primal');
}

function displayPokemonName(detail, speciesName = '') {
  const raw = String(detail.name || '');
  if (raw.includes('-mega')) {
    const suffix = raw.replace(`${speciesName}-mega`, '').replace(/^-/, '');
    return suffix ? `Mega ${title(speciesName)} ${title(suffix)}` : `Mega ${title(speciesName)}`;
  }
  if (raw.endsWith('-primal')) return `Primal ${title(speciesName || raw.replace('-primal', ''))}`;
  return title(raw);
}

function isBattleRelevantItem(detail) {
  const category = detail.category?.name || '';
  if (BATTLE_ITEM_CATEGORIES.has(category)) return true;
  return Boolean(detail.attributes?.some(attribute => ['holdable', 'holdable-active'].includes(attribute.name || attribute.attribute?.name)));
}

function isChampionsLegalItem(detail) {
  const category = detail.category?.name || '';
  if (category === 'mega-stones') return true;
  if (String(detail.name || '').endsWith('-berry')) return true;
  return isBattleRelevantItem(detail);
}

function isChampionsLegalPokemon(detail) {
  const name = String(detail.name || '').toLowerCase();
  if (name.includes('-totem')) return false;
  if (name.includes('-starter')) return false;
  if (name.includes('-battle-bond')) return false;
  return true;
}

function englishEffect(entries = [], field = 'effect') {
  const entry = entries.find(item => item.language?.name === 'en') || entries[0];
  return entry?.[field]?.replace(/\n|\f/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

function englishShortEffect(entries = []) {
  return englishEffect(entries, 'short_effect') || englishEffect(entries, 'effect');
}

async function requestJson(url, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (response.ok) return response.json();
    if (attempt === attempts) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
}

async function upsert(table, rows, conflictColumn) {
  const conflictColumns = conflictColumn.split(',').map(column => column.trim()).filter(Boolean);
  const uniqueRows = [];
  const seen = new Set();

  for (const row of rows) {
    const key = conflictColumns.map(column => String(row[column] ?? '')).join('\u001f');
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  if (uniqueRows.length !== rows.length) {
    console.log(`${table}: ${rows.length - uniqueRows.length} doppelte Import-Zeilen uebersprungen`);
  }

  for (let start = 0; start < uniqueRows.length; start += 250) {
    const chunk = uniqueRows.slice(start, start + 250);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictColumn}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    console.log(`${table}: ${Math.min(start + chunk.length, uniqueRows.length)}/${uniqueRows.length}`);
  }
}

async function importSimpleCatalog(endpoint, table) {
  const data = await requestJson(`${POKEAPI}/${endpoint}?limit=100000`);
  const rows = data.results.map(entry => ({ id: entry.name, display_name: title(entry.name), source: 'pokeapi', updated_at: new Date().toISOString() }));
  await upsert(table, rows, 'id');
}

async function importMoves() {
  const data = await requestJson(`${POKEAPI}/move?limit=100000`);
  const rows = await mapConcurrent(data.results, 14, async entry => {
    const detail = await requestJson(entry.url);
    return {
      id: detail.name,
      display_name: title(detail.name),
      type: detail.type?.name || null,
      damage_class: detail.damage_class?.name || null,
      power: detail.power,
      accuracy: detail.accuracy,
      pp: detail.pp,
      priority: detail.priority || 0,
      generation: generationNumber(detail.generation?.name),
      effect_text: englishEffect(detail.effect_entries, 'effect'),
      short_effect: englishShortEffect(detail.effect_entries),
      is_champions_legal: true,
      source: 'pokeapi',
      updated_at: new Date().toISOString(),
    };
  });
  await upsert('move_catalog', rows, 'id');
}

async function importAbilities() {
  const data = await requestJson(`${POKEAPI}/ability?limit=100000`);
  const rows = await mapConcurrent(data.results, 14, async entry => {
    const detail = await requestJson(entry.url);
    return {
      id: detail.name,
      display_name: title(detail.name),
      generation: generationNumber(detail.generation?.name),
      effect_text: englishEffect(detail.effect_entries, 'effect'),
      short_effect: englishShortEffect(detail.effect_entries),
      source: 'pokeapi',
      updated_at: new Date().toISOString(),
    };
  });
  await upsert('ability_catalog', rows, 'id');
}

async function importItems() {
  const data = await requestJson(`${POKEAPI}/item?limit=100000`);
  const rows = await mapConcurrent(data.results, 12, async entry => {
    const detail = await requestJson(entry.url);
    return {
      id: entry.name,
      display_name: title(entry.name),
      category: detail.category?.name || null,
      effect_text: englishEffect(detail.effect_entries, 'effect'),
      short_effect: englishShortEffect(detail.effect_entries),
      fling_power: detail.fling_power,
      is_battle_relevant: isBattleRelevantItem(detail),
      is_champions_legal: isChampionsLegalItem(detail),
      source: 'pokeapi',
      updated_at: new Date().toISOString(),
    };
  });
  await upsert('item_catalog', rows, 'id');
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
      if ((index + 1) % 50 === 0) console.log(`Pokémon geladen: ${index + 1}/${values.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function importPokemon() {
  const data = await requestJson(`${POKEAPI}/pokemon-species?limit=2000`);
  const species = data.results.filter(entry => Number.isInteger(idFromUrl(entry.url)));
  const rows = await mapConcurrent(species, 10, async entry => {
    const dexNumber = idFromUrl(entry.url);
    const [speciesDetail, pokemonDetail] = await Promise.all([
      requestJson(entry.url),
      requestJson(`${POKEAPI}/pokemon/${dexNumber}`),
    ]);
    return {
      dex_number: dexNumber,
      pokemon_id: entry.name,
      pokemon_name: displayPokemonName(pokemonDetail, entry.name),
      generation: generationNumber(speciesDetail.generation?.name),
      types: pokemonDetail.types.map(item => item.type.name),
      species_id: entry.name,
      is_default: true,
      is_champions_legal: isChampionsLegalPokemon(pokemonDetail),
      ...baseStatsFromPokemon(pokemonDetail),
      updated_at: new Date().toISOString(),
    };
  });
  const valid = rows.filter(row => row.generation);
  await upsert('pokemon_catalog', valid, 'dex_number');
}

async function importPokemonAbilities() {
  const data = await requestJson(`${POKEAPI}/pokemon?limit=2000`);
  const pokemon = data.results.filter(entry => Number.isInteger(idFromUrl(entry.url)));
  const rowsNested = await mapConcurrent(pokemon, 12, async entry => {
    const detail = await requestJson(entry.url);
    return (detail.abilities || []).map(item => ({
      pokemon_id: detail.name,
      ability_id: item.ability?.name,
      display_name: title(item.ability?.name || ''),
      slot: item.slot || null,
      is_hidden: Boolean(item.is_hidden),
      source: 'pokeapi',
      updated_at: new Date().toISOString(),
    })).filter(row => row.ability_id);
  });
  await upsert('pokemon_ability_catalog', rowsNested.flat(), 'pokemon_id,ability_id');
}

async function importPokemonMoves() {
  const data = await requestJson(`${POKEAPI}/pokemon?limit=2000`);
  const pokemon = data.results.filter(entry => Number.isInteger(idFromUrl(entry.url)));
  const rowsNested = await mapConcurrent(pokemon, 8, async entry => {
    const detail = await requestJson(entry.url);
    return (detail.moves || []).flatMap(move => (move.version_group_details || []).map(version => {
      const isCurrent = version.version_group?.name === CURRENT_VERSION_GROUP;
      return {
        pokemon_id: detail.name,
        move_id: move.move?.name,
        display_name: title(move.move?.name || ''),
        version_group: version.version_group?.name || null,
        learn_method: version.move_learn_method?.name || null,
        level_learned_at: version.level_learned_at || 0,
        is_current_gen_legal: isCurrent,
        is_champions_legal: isCurrent,
        source: 'pokeapi',
        updated_at: new Date().toISOString(),
      };
    })).filter(row => row.move_id && row.version_group && row.learn_method);
  });
  await upsert('pokemon_move_catalog', rowsNested.flat(), 'pokemon_id,move_id,version_group,learn_method');
}

async function importPokemonForms() {
  const data = await requestJson(`${POKEAPI}/pokemon-species?limit=2000`);
  const species = data.results.filter(entry => Number.isInteger(idFromUrl(entry.url)));
  const rowsNested = await mapConcurrent(species, 8, async entry => {
    const speciesDetail = await requestJson(entry.url);
    const generation = generationNumber(speciesDetail.generation?.name);
    if (!generation) return [];
    const varieties = speciesDetail.varieties || [];
    return Promise.all(varieties.map(async variety => {
      const detail = await requestJson(variety.pokemon.url);
      return {
        pokemon_id: detail.name,
        species_pokemon_id: entry.name,
        pokemon_name: displayPokemonName(detail, entry.name),
        form_name: variety.is_default ? 'Default' : title(detail.name.replace(`${entry.name}-`, '')),
        generation,
        types: detail.types.map(item => item.type.name),
        is_default: Boolean(variety.is_default),
        is_mega: isMegaPokemon(detail),
        is_champions_legal: isChampionsLegalPokemon(detail),
        ...baseStatsFromPokemon(detail),
        source: 'pokeapi',
        updated_at: new Date().toISOString(),
      };
    }));
  });
  await upsert('pokemon_form_catalog', rowsNested.flat(), 'pokemon_id');
}

const jobs = [];
if (!args.has('--skip-moves')) jobs.push(['Moves', importMoves]);
if (!args.has('--skip-items')) jobs.push(['Items', importItems]);
if (!args.has('--skip-abilities')) jobs.push(['Fähigkeiten', importAbilities]);
if (!args.has('--skip-pokemon')) jobs.push(['Pokémon', importPokemon]);
if (!args.has('--skip-forms')) jobs.push(['Pokémon-Formen', importPokemonForms]);
if (!args.has('--skip-pokemon-abilities')) jobs.push(['Pokémon-Fähigkeiten', importPokemonAbilities]);
if (!args.has('--skip-pokemon-moves')) jobs.push(['Pokémon-Movesets', importPokemonMoves]);

for (const [name, job] of jobs) {
  console.log(`\n${name} werden importiert …`);
  await job();
}
console.log('\nReferenzdaten vollständig importiert.');
