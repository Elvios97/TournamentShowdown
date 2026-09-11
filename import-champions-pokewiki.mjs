const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const POKEMON_URL = 'https://pokewiki.de/Liste_der_Pok%C3%A9mon_in_Pok%C3%A9mon_Champions';
const ITEMS_URL = 'https://pokewiki.de/Item-Liste_(Pok%C3%A9mon_Champions)';
const POKEWIKI_BASE = 'https://pokewiki.de';
const POKEAPI = 'https://pokeapi.co/api/v2';
const MOVE_TYPES = {
  normal: 'normal',
  feuer: 'fire',
  fire: 'fire',
  wasser: 'water',
  water: 'water',
  elektro: 'electric',
  electric: 'electric',
  pflanze: 'grass',
  grass: 'grass',
  eis: 'ice',
  ice: 'ice',
  kampf: 'fighting',
  fighting: 'fighting',
  gift: 'poison',
  poison: 'poison',
  boden: 'ground',
  ground: 'ground',
  flug: 'flying',
  flying: 'flying',
  psycho: 'psychic',
  psychic: 'psychic',
  kaefer: 'bug',
  kafer: 'bug',
  käfer: 'bug',
  bug: 'bug',
  gestein: 'rock',
  rock: 'rock',
  geist: 'ghost',
  ghost: 'ghost',
  drache: 'dragon',
  dragon: 'dragon',
  unlicht: 'dark',
  dark: 'dark',
  stahl: 'steel',
  steel: 'steel',
  fee: 'fairy',
  fairy: 'fairy',
};
const DAMAGE_CLASSES = {
  physisch: 'physical',
  physical: 'physical',
  spezial: 'special',
  speziell: 'special',
  special: 'special',
  status: 'status',
};

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
  process.exit(1);
}

const USER_AGENT = 'Mozilla/5.0 OTS-DraftHub/1.0';
const title = slug => slug.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
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

function decodeHtml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(html = '') {
  return decodeHtml(html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function searchNames(...values) {
  return [...new Set(values.flat().filter(Boolean).map(value => String(value).trim().toLowerCase()).filter(Boolean))];
}

function moveLookupKey(value = '') {
  return slugify(value).replace(/-/g, '');
}

async function getExistingMoveNameMap() {
  const rows = await supabaseRequest('move_catalog?select=id,display_name,english_name,german_name');
  const map = new Map();
  (rows || []).forEach(row => {
    [row.id, row.display_name, row.english_name, row.german_name].filter(Boolean).forEach(value => {
      const key = moveLookupKey(value);
      if (key && !map.has(key)) map.set(key, row);
    });
  });
  return map;
}

function cleanWikiText(value = '') {
  let text = String(value);
  let previous = '';
  while (text !== previous && /\{\{[^{}]+\}\}/.test(text)) {
    previous = text;
    text = text.replace(/\{\{([^{}]+)\}\}/g, (_, body) => {
      const parts = splitTemplateArgs(body).map(part => part.trim()).filter(Boolean);
      const positional = parts.slice(1).filter(part => !part.includes('='));
      return positional[0] || '';
    });
  }
  return stripTags(text
    .replace(/\[\[Datei:[^\]]+\]\]/gi, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/&nbsp;/g, ' '));
}

function splitTemplateArgs(body = '') {
  const parts = [];
  let current = '';
  let braces = 0;
  let brackets = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const next = body[index + 1];
    if (char === '{' && next === '{') braces += 1;
    if (char === '}' && next === '}' && braces > 0) braces -= 1;
    if (char === '[' && next === '[') brackets += 1;
    if (char === ']' && next === ']' && brackets > 0) brackets -= 1;
    if (char === '|' && braces === 0 && brackets === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function parseNullableNumber(value = '') {
  const text = cleanWikiText(value);
  const raw = text.replace(/[^\d-]/g, '');
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function normalizeLookupKey(value = '') {
  return cleanWikiText(value)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .trim();
}

function normalizeMoveType(value = '') {
  const key = normalizeLookupKey(value);
  return MOVE_TYPES[key] || null;
}

function normalizeDamageClass(value = '') {
  const key = normalizeLookupKey(value);
  return DAMAGE_CLASSES[key] || null;
}

async function requestText(url) {
  const response = await fetch(url, { headers: { accept: 'text/html', 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function requestJson(url, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
    if (response.ok) return response.json();
    if (attempt === attempts) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function patch(table, query, patchBody) {
  return supabaseRequest(`${table}?${query}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(patchBody),
  });
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

  for (let start = 0; start < uniqueRows.length; start += 250) {
    const chunk = uniqueRows.slice(start, start + 250);
    await supabaseRequest(`${table}?on_conflict=${conflictColumn}`, {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
  }
}

async function resetChampionsMoveLinksForPokemon(pokemonIds = []) {
  const ids = [...new Set(pokemonIds.filter(Boolean))];
  for (let start = 0; start < ids.length; start += 25) {
    const chunk = ids.slice(start, start + 25).map(encodeURIComponent).join(',');
    await patch(
      'pokemon_move_catalog',
      `pokemon_id=in.(${chunk})&version_group=eq.pokemon-champions&learn_method=eq.champions-management&is_champions_legal=eq.true`,
      { is_champions_legal: false },
    );
  }
}

function baseStatsFromPokemon(detail) {
  const stats = {};
  for (const entry of detail.stats || []) {
    const column = STAT_COLUMNS[entry.stat?.name];
    if (column) stats[column] = entry.base_stat;
  }
  return stats;
}

async function fetchCatalogRowsByDexNumbers(dexNumbers = [], select = 'dex_number,pokemon_id') {
  const rows = [];
  const uniqueDexNumbers = [...new Set(dexNumbers.filter(Number.isInteger))];
  for (let start = 0; start < uniqueDexNumbers.length; start += 100) {
    const chunk = uniqueDexNumbers.slice(start, start + 100).join(',');
    if (!chunk) continue;
    const result = await supabaseRequest(`pokemon_catalog?select=${encodeURIComponent(select)}&dex_number=in.(${chunk})`);
    rows.push(...(result || []));
  }
  return rows;
}

async function buildPokemonCatalogRow(dexNumber, data) {
  const [speciesDetail, pokemonDetail] = await Promise.all([
    requestJson(`${POKEAPI}/pokemon-species/${dexNumber}`),
    requestJson(`${POKEAPI}/pokemon/${dexNumber}`),
  ]);
  const generation = generationNumber(speciesDetail.generation?.name);
  if (!generation) throw new Error(`Keine Generation fuer Dex #${dexNumber}`);

  return {
    dex_number: dexNumber,
    pokemon_id: speciesDetail.name,
    pokemon_name: title(pokemonDetail.name),
    generation,
    types: pokemonDetail.types.map(item => item.type.name),
    species_id: speciesDetail.name,
    german_name: [...data.names][0] || null,
    champions_rulesets: [...data.rulesets].filter(Boolean),
    is_default: true,
    is_champions_legal: true,
    ...baseStatsFromPokemon(pokemonDetail),
    updated_at: new Date().toISOString(),
  };
}

function tableRows(html) {
  return [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(match => match[0]);
}

function tableCells(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1]);
}

function findTemplateBodies(text = '', templateName = '') {
  const bodies = [];
  const needle = `{{${templateName}`;
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf(needle, index);
    if (start < 0) break;
    let depth = 0;
    let cursor = start;
    for (; cursor < text.length - 1; cursor += 1) {
      const pair = text.slice(cursor, cursor + 2);
      if (pair === '{{') {
        depth += 1;
        cursor += 1;
        continue;
      }
      if (pair === '}}') {
        depth -= 1;
        cursor += 1;
        if (depth === 0) {
          bodies.push(text.slice(start + needle.length + 1, cursor - 1));
          break;
        }
      }
    }
    index = cursor + 1;
  }
  return bodies;
}

function championsSection(raw = '') {
  const heading = raw.match(/^==\s*Pok(?:é|Ã©)mon Champions\s*==\s*$/im);
  if (!heading) return '';
  const rest = raw.slice(heading.index);
  const nextHeading = rest.slice(heading[0].length).search(/\n==[^=]/);
  return nextHeading >= 0 ? rest.slice(0, heading[0].length + nextHeading) : rest;
}

function firstTextArg(args = [], start = 0) {
  for (let index = start; index < args.length; index += 1) {
    const value = cleanWikiText(args[index]);
    if (value && !value.includes('=')) return value;
  }
  return '';
}

function parsePokemonPage(html) {
  const rows = [];
  for (const row of tableRows(html)) {
    const cells = tableCells(row);
    if (cells.length < 4) continue;
    const dex = Number(stripTags(cells[0]));
    if (!Number.isInteger(dex) || dex <= 0) continue;
    const germanName = stripTags(cells[2]);
    const ruleset = stripTags(cells[cells.length - 1]);
    rows.push({ dex_number: dex, german_name: germanName, ruleset });
  }
  return rows;
}

function parseItemPage(html) {
  const start = html.indexOf('id="Getragene_Items"');
  const relevant = start >= 0 ? html.slice(start) : html;
  const rows = [];
  for (const row of tableRows(relevant)) {
    const cells = tableCells(row);
    if (cells.length < 3) continue;
    const germanName = stripTags(cells[1]);
    const description = stripTags(cells[2]);
    const category = stripTags(cells[3] || '') || 'Getragenes Item';
    if (!germanName || /Name/i.test(germanName)) continue;
    if (/Ticket/i.test(germanName) || /Ticket/i.test(category)) continue;
    rows.push({ german_name: germanName, description, category });
  }
  return rows;
}

function parseChampionsMoves(raw) {
  const section = championsSection(raw);
  if (!section) return parseChampionsMovesFromHtml(raw);
  const rows = [];
  for (const body of findTemplateBodies(section, 'AtkRow')) {
    const args = splitTemplateArgs(body);
    const name = firstTextArg(args, 1);
    if (!name || name.includes('=')) continue;
    rows.push({
      german_name: name,
      type: normalizeMoveType(args[2]),
      damage_class: normalizeDamageClass(args[3]),
      power: parseNullableNumber(args[4]),
      accuracy: parseNullableNumber(args[5]),
      pp: parseNullableNumber(args[6]),
    });
  }
  return dedupeChampionMoves(rows);
}

function parseChampionsMovesFromHtml(html) {
  const marker = html.search(/id=["']Pok(?:é|Ã©)mon_Champions["']/i);
  if (marker < 0) return [];
  const nextHeading = html.slice(marker + 1).search(/<h2\b/i);
  const section = nextHeading >= 0 ? html.slice(marker, marker + nextHeading + 1) : html.slice(marker);
  const rows = [];
  for (const row of tableRows(section)) {
    const cells = tableCells(row).map(cell => stripTags(cell));
    if (cells.length < 6) continue;
    const [name, type, damageClass, power, accuracy, pp] = cells;
    if (!name || /attacke|name/i.test(name)) continue;
    rows.push({
      german_name: name,
      type: normalizeMoveType(type),
      damage_class: normalizeDamageClass(damageClass),
      power: parseNullableNumber(power),
      accuracy: parseNullableNumber(accuracy),
      pp: parseNullableNumber(pp),
    });
  }
  return dedupeChampionMoves(rows);
}

function championMoveKey(move = {}) {
  return normalizeLookupKey(move.german_name);
}

function championMoveCompleteness(move = {}) {
  return [move.type, move.damage_class, move.power, move.accuracy, move.pp].filter(value => value != null).length;
}

function dedupeChampionMoves(rows = []) {
  const deduped = new Map();
  rows.forEach(row => {
    const key = championMoveKey(row);
    if (!key) return;
    const current = deduped.get(key);
    if (!current || championMoveCompleteness(row) > championMoveCompleteness(current)) deduped.set(key, row);
  });
  return [...deduped.values()];
}

async function mapConcurrent(values, concurrency, mapper, progressLabel = 'Champions-Attacken geprueft') {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
      if ((index + 1) % 25 === 0) console.log(`${progressLabel}: ${index + 1}/${values.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function applyPokemonOverrides(entries) {
  await patch('pokemon_catalog', 'is_champions_legal=eq.true', { is_champions_legal: false, champions_rulesets: [] });
  await patch('pokemon_form_catalog', 'is_champions_legal=eq.true', { is_champions_legal: false, champions_rulesets: [] });

  const grouped = new Map();
  entries.forEach(entry => {
    if (!grouped.has(entry.dex_number)) grouped.set(entry.dex_number, { names: new Set(), rulesets: new Set() });
    grouped.get(entry.dex_number).names.add(entry.german_name);
    if (entry.ruleset) grouped.get(entry.dex_number).rulesets.add(entry.ruleset);
  });

  const dexNumbers = [...grouped.keys()];
  const existingRows = await fetchCatalogRowsByDexNumbers(dexNumbers);
  const existingDexNumbers = new Set(existingRows.map(row => row.dex_number));
  const missingDexNumbers = dexNumbers.filter(dexNumber => !existingDexNumbers.has(dexNumber));

  if (missingDexNumbers.length) {
    console.log(`pokemon_catalog: ${missingDexNumbers.length} fehlende Champions-Pokemon werden aus PokeAPI nachgeladen.`);
    const missingRows = await mapConcurrent(
      missingDexNumbers,
      8,
      async dexNumber => buildPokemonCatalogRow(dexNumber, grouped.get(dexNumber)),
      'Fehlende Champions-Pokemon geladen',
    );
    await upsert('pokemon_catalog', missingRows, 'dex_number');
  }

  for (const [dexNumber, data] of grouped.entries()) {
    const germanName = [...data.names][0] || null;
    const rulesets = [...data.rulesets].filter(Boolean);
    await patch('pokemon_catalog', `dex_number=eq.${dexNumber}`, {
      german_name: germanName,
      champions_rulesets: rulesets,
      is_champions_legal: true,
    });
    const speciesRows = await supabaseRequest(`pokemon_catalog?select=pokemon_id&dex_number=eq.${dexNumber}`);
    const speciesId = speciesRows?.[0]?.pokemon_id;
    if (speciesId) {
      await patch('pokemon_form_catalog', `species_pokemon_id=eq.${encodeURIComponent(speciesId)}`, {
        german_name: germanName,
        champions_rulesets: rulesets,
        is_champions_legal: true,
      });
    }
  }

  const markedRows = await fetchCatalogRowsByDexNumbers(dexNumbers, 'dex_number,pokemon_id,is_champions_legal');
  const markedCount = markedRows.filter(row => row.is_champions_legal === true).length;
  const unresolvedDexNumbers = dexNumbers.filter(dexNumber => !markedRows.some(row => row.dex_number === dexNumber));
  if (unresolvedDexNumbers.length) {
    console.warn(`pokemon_catalog: ${unresolvedDexNumbers.length} Champions-Dexnummern fehlen weiter: ${unresolvedDexNumbers.join(', ')}`);
  }

  return {
    listed: grouped.size,
    marked: markedCount,
    created: missingDexNumbers.length,
    unresolved: unresolvedDexNumbers.length,
  };
}

async function getChampionsSpecies(entries) {
  const dexNumbers = [...new Set(entries.map(entry => entry.dex_number).filter(Boolean))];
  const result = [];
  for (const dexNumber of dexNumbers) {
    const rows = await supabaseRequest(`pokemon_catalog?select=dex_number,pokemon_id,german_name&dex_number=eq.${dexNumber}`);
    const row = rows?.[0];
    if (!row?.pokemon_id) continue;
    const source = entries.find(entry => entry.dex_number === dexNumber);
    result.push({
      dex_number: dexNumber,
      pokemon_id: row.pokemon_id,
      german_name: row.german_name || source?.german_name || row.pokemon_id,
    });
  }
  return result;
}

async function fetchChampionsMovesForSpecies(species) {
  const titles = [...new Set([
    species.german_name,
    species.german_name.replace(/\s*\([^)]*\)\s*/g, ' ').trim(),
    species.german_name.replace(/\s+/g, ' ').trim(),
  ].filter(Boolean).map(name => encodeURIComponent(name.replace(/\s+/g, '_'))))];
  const errors = [];
  try {
    for (const title of titles) {
      try {
        const raw = await requestText(`${POKEWIKI_BASE}/index.php?title=${title}/Attacken&action=raw`);
        const rawMoves = parseChampionsMoves(raw);
        const html = await requestText(`${POKEWIKI_BASE}/${title}/Attacken`);
        const htmlMoves = parseChampionsMovesFromHtml(html);
        const moves = htmlMoves.length > rawMoves.length ? htmlMoves : rawMoves;
        if (moves.length) {
          if (rawMoves.length && htmlMoves.length && rawMoves.length !== htmlMoves.length) {
            console.log(`Champions-Attacken ${species.german_name}: Raw ${rawMoves.length}, HTML ${htmlMoves.length}, nutze ${moves.length}.`);
          }
          return moves.map(move => ({ ...move, pokemon_id: species.pokemon_id }));
        }
      } catch (error) {
        errors.push(error.message);
      }
    }
    throw new Error(errors[errors.length - 1] || 'Keine passende PokéWiki-Seite gefunden.');
  } catch (error) {
    console.warn(`Keine Champions-Attacken fuer ${species.german_name}: ${error.message}`);
    return [];
  }
}

async function applyMoveOverrides(entries) {
  const species = await getChampionsSpecies(entries);

  const nestedMoves = await mapConcurrent(species, 5, fetchChampionsMovesForSpecies);
  const allMoves = nestedMoves.flat();
  const existingMoves = await getExistingMoveNameMap();
  const moveIdFor = move => existingMoves.get(moveLookupKey(move.german_name))?.id || `champions-${slugify(move.german_name)}`;
  const moveNamesFor = move => {
    const existing = existingMoves.get(moveLookupKey(move.german_name));
    return {
      display: move.german_name,
      english: existing?.english_name || existing?.display_name || null,
      german: move.german_name,
    };
  };
  const moveCatalogRows = allMoves.map(move => ({
    id: moveIdFor(move),
    display_name: moveNamesFor(move).display,
    english_name: moveNamesFor(move).english,
    german_name: moveNamesFor(move).german,
    search_names: searchNames(moveIdFor(move), moveNamesFor(move).display, moveNamesFor(move).english, moveNamesFor(move).german),
    type: move.type,
    damage_class: move.damage_class,
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    priority: 0,
    generation: 9,
    is_champions_legal: true,
    source: 'pokewiki',
    updated_at: new Date().toISOString(),
  }));
  await upsert('move_catalog', moveCatalogRows, 'id');

  const formRows = await supabaseRequest('pokemon_form_catalog?select=pokemon_id,species_pokemon_id,is_champions_legal&is_champions_legal=eq.true');
  const formsBySpecies = new Map();
  (formRows || []).forEach(form => {
    if (!formsBySpecies.has(form.species_pokemon_id)) formsBySpecies.set(form.species_pokemon_id, []);
    formsBySpecies.get(form.species_pokemon_id).push(form.pokemon_id);
  });
  const resetTargets = species.flatMap(entry => [entry.pokemon_id, ...(formsBySpecies.get(entry.pokemon_id) || [])]);
  await resetChampionsMoveLinksForPokemon(resetTargets);

  const moveRows = [];
  allMoves.forEach(move => {
    const targets = new Set([move.pokemon_id, ...(formsBySpecies.get(move.pokemon_id) || [])]);
    targets.forEach(pokemonId => {
      const names = moveNamesFor(move);
      const moveId = moveIdFor(move);
      moveRows.push({
        pokemon_id: pokemonId,
        move_id: moveId,
        display_name: names.display,
        english_name: names.english,
        german_name: names.german,
        search_names: searchNames(moveId, names.display, names.english, names.german),
        version_group: 'pokemon-champions',
        learn_method: 'champions-management',
        level_learned_at: 0,
        is_current_gen_legal: false,
        is_champions_legal: true,
        source: 'pokewiki',
        updated_at: new Date().toISOString(),
      });
    });
  });
  await upsert('pokemon_move_catalog', moveRows, 'pokemon_id,move_id,version_group,learn_method');
  return { species: species.length, moves: moveCatalogRows.length, links: moveRows.length };
}

async function applyItemOverrides(entries) {
  const rows = entries.map(entry => ({
    id: `champions-${slugify(entry.german_name)}`,
    display_name: entry.german_name,
    german_name: entry.german_name,
    search_names: searchNames(entry.german_name, `champions-${slugify(entry.german_name)}`),
    category: entry.category,
    champions_category: entry.category,
    short_effect: entry.description,
    effect_text: entry.description,
    is_battle_relevant: true,
    is_champions_legal: true,
    source: 'pokewiki',
    updated_at: new Date().toISOString(),
  }));
  await upsert('item_catalog', rows, 'id');
  return rows.length;
}

const [pokemonHtml, itemHtml] = await Promise.all([requestText(POKEMON_URL), requestText(ITEMS_URL)]);
const pokemon = parsePokemonPage(pokemonHtml);
const items = parseItemPage(itemHtml);
const pokemonCount = await applyPokemonOverrides(pokemon);
const itemCount = await applyItemOverrides(items);
const moveCount = await applyMoveOverrides(pokemon);
console.log(`Champions-Attacken Import: ${moveCount.moves} Attacken aus ${moveCount.species} Pokemon-Seiten importiert, ${moveCount.links} Pokemon-Move-Zuordnungen gesetzt.`);

console.log(`PokéWiki Champions Import: ${pokemonCount.marked}/${pokemonCount.listed} Pokémon-Dexnummern legal, ${pokemonCount.created} Katalogeintraege nachgeladen, ${itemCount} Items legal (Tickets ignoriert).`);
if (pokemonCount.unresolved) {
  console.warn(`PokéWiki Champions Import: ${pokemonCount.unresolved} Pokémon-Dexnummern konnten nicht im Katalog gesetzt werden.`);
}
