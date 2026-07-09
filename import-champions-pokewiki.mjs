const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const POKEMON_URL = 'https://pokewiki.de/Liste_der_Pok%C3%A9mon_in_Pok%C3%A9mon_Champions';
const ITEMS_URL = 'https://pokewiki.de/Item-Liste_(Pok%C3%A9mon_Champions)';
const POKEWIKI_BASE = 'https://pokewiki.de';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
  process.exit(1);
}

const USER_AGENT = 'Mozilla/5.0 OTS-DraftHub/1.0';

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

function cleanWikiText(value = '') {
  return stripTags(String(value)
    .replace(/\[\[Datei:[^\]]+\]\]/gi, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^}]+\}\}/g, '')
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
  const number = Number(text.replace(/[^\d-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

async function requestText(url) {
  const response = await fetch(url, { headers: { accept: 'text/html', 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
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

function tableRows(html) {
  return [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(match => match[0]);
}

function tableCells(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1]);
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
  const start = raw.indexOf('== Pokémon Champions ==');
  if (start < 0) return [];
  const rest = raw.slice(start);
  const nextHeading = rest.slice(1).search(/\n==[^=]/);
  const section = nextHeading >= 0 ? rest.slice(0, nextHeading + 1) : rest;
  const rows = [];
  for (const match of section.matchAll(/\{\{AtkRow\|([\s\S]*?)\}\}/g)) {
    const args = splitTemplateArgs(match[1]);
    const name = cleanWikiText(args[1]);
    if (!name || name.includes('=')) continue;
    rows.push({
      german_name: name,
      type: cleanWikiText(args[2]).toLowerCase() || null,
      damage_class: cleanWikiText(args[3]).toLowerCase() || null,
      power: parseNullableNumber(args[4]),
      accuracy: parseNullableNumber(args[5]),
      pp: parseNullableNumber(args[6]),
    });
  }
  return rows;
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
      if ((index + 1) % 25 === 0) console.log(`Champions-Attacken geprueft: ${index + 1}/${values.length}`);
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

  return grouped.size;
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
  const title = encodeURIComponent(species.german_name.replace(/\s+/g, '_'));
  try {
    const raw = await requestText(`${POKEWIKI_BASE}/index.php?title=${title}/Attacken&action=raw`);
    return parseChampionsMoves(raw).map(move => ({ ...move, pokemon_id: species.pokemon_id }));
  } catch (error) {
    console.warn(`Keine Champions-Attacken fuer ${species.german_name}: ${error.message}`);
    return [];
  }
}

async function applyMoveOverrides(entries) {
  const species = await getChampionsSpecies(entries);
  await patch('pokemon_move_catalog', 'is_champions_legal=eq.true', { is_champions_legal: false });

  const nestedMoves = await mapConcurrent(species, 5, fetchChampionsMovesForSpecies);
  const allMoves = nestedMoves.flat();
  const moveCatalogRows = allMoves.map(move => ({
    id: `champions-${slugify(move.german_name)}`,
    display_name: move.german_name,
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

  const moveRows = [];
  allMoves.forEach(move => {
    const targets = new Set([move.pokemon_id, ...(formsBySpecies.get(move.pokemon_id) || [])]);
    targets.forEach(pokemonId => {
      moveRows.push({
        pokemon_id: pokemonId,
        move_id: `champions-${slugify(move.german_name)}`,
        display_name: move.german_name,
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
  await patch('item_catalog', 'is_champions_legal=eq.true', { is_champions_legal: false });
  const rows = entries.map(entry => ({
    id: `champions-${slugify(entry.german_name)}`,
    display_name: entry.german_name,
    german_name: entry.german_name,
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

console.log(`PokéWiki Champions Import: ${pokemonCount} Pokémon-Dexnummern legal, ${itemCount} Items legal (Tickets ignoriert).`);
