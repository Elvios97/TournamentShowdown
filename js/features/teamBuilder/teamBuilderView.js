import { getCurrentUserId } from '../../auth.js';
import { esc, toast } from '../../utils.js';
import { spriteAttrs, toPokemonId } from '../../sprites.js?v=20260710e';
import { listPokemonCatalog, listPokemonForms } from '../pools/pools.js';
import { listPokemonAbilitiesForPokemon, listPokemonMovesForPokemon, listReferenceCatalogs } from '../catalogs/referenceCatalogs.js?v=20260712a';
import {
  getSheet, listPokemonForSheet, updateSheet, addPokemonSet, updatePokemonSet,
  deletePokemonSet, deleteSheet, updatePokemonSetOrder, importShowdownIntoSheet, exportSheetAsShowdown,
} from '../teams/teamSheets.js?v=20260710e';
import { validateTeam } from '../teams/teamValidation.js?v=20260713a';
import {
  STAT_KEYS, calculatePokemonStats, getBaseStats, normalizeStatSpread,
  speedOrder, validateChampionsDvs,
} from '../teams/teamStats.js?v=20260708a';

const STAT_LABELS = { HP: 'KP', Atk: 'Atk', Def: 'Def', SpA: 'SpA', SpD: 'SpD', Spe: 'Spe' };
const TYPE_LABELS = {
  normal: 'Normal', fire: 'Feuer', water: 'Wasser', electric: 'Elektro', grass: 'Pflanze', ice: 'Eis',
  fighting: 'Kampf', poison: 'Gift', ground: 'Boden', flying: 'Flug', psychic: 'Psycho', bug: 'Kaefer',
  rock: 'Gestein', ghost: 'Geist', dragon: 'Drache', dark: 'Unlicht', steel: 'Stahl', fairy: 'Fee',
};
const TYPE_ORDER = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};
const NATURE_OPTIONS = [
  ['Adamant', 'Hart', 'Atk', 'SpA'], ['Bashful', 'Zaghaft', null, null], ['Bold', 'Kuehn', 'Def', 'Atk'],
  ['Brave', 'Mutig', 'Atk', 'Spe'], ['Calm', 'Still', 'SpD', 'Atk'], ['Careful', 'Sacht', 'SpD', 'SpA'],
  ['Docile', 'Sanft', null, null], ['Gentle', 'Zart', 'SpD', 'Def'], ['Hardy', 'Robust', null, null],
  ['Hasty', 'Hastig', 'Spe', 'Def'], ['Impish', 'Pfiffig', 'Def', 'SpA'], ['Jolly', 'Froh', 'Spe', 'SpA'],
  ['Lax', 'Lasch', 'Def', 'SpD'], ['Lonely', 'Solo', 'Atk', 'Def'], ['Mild', 'Mild', 'SpA', 'Def'],
  ['Modest', 'Maessig', 'SpA', 'Atk'], ['Naive', 'Naiv', 'Spe', 'SpD'], ['Naughty', 'Frech', 'Atk', 'SpD'],
  ['Quiet', 'Ruhig', 'SpA', 'Spe'], ['Quirky', 'Kauzig', null, null], ['Rash', 'Hitzig', 'SpA', 'SpD'],
  ['Relaxed', 'Locker', 'Def', 'Spe'], ['Sassy', 'Forsch', 'SpD', 'Spe'], ['Serious', 'Ernst', null, null],
  ['Timid', 'Scheu', 'Spe', 'Atk'],
];
const ABILITY_OVERRIDES = {
  venusaur: [
    { pokemon_id: 'venusaur', ability_id: 'overgrow', display_name: 'Overgrow', slot: 1, is_hidden: false },
    { pokemon_id: 'venusaur', ability_id: 'chlorophyll', display_name: 'Chlorophyll', slot: 3, is_hidden: true },
  ],
  'venusaur-mega': [
    { pokemon_id: 'venusaur-mega', ability_id: 'thick-fat', display_name: 'Thick Fat', slot: 1, is_hidden: false },
  ],
  charizard: [
    { pokemon_id: 'charizard', ability_id: 'blaze', display_name: 'Blaze', slot: 1, is_hidden: false },
    { pokemon_id: 'charizard', ability_id: 'solar-power', display_name: 'Solar Power', slot: 3, is_hidden: true },
  ],
  'charizard-mega-x': [
    { pokemon_id: 'charizard-mega-x', ability_id: 'tough-claws', display_name: 'Tough Claws', slot: 1, is_hidden: false },
  ],
  'charizard-mega-y': [
    { pokemon_id: 'charizard-mega-y', ability_id: 'drought', display_name: 'Drought', slot: 1, is_hidden: false },
  ],
  'blastoise-mega': [{ pokemon_id: 'blastoise-mega', ability_id: 'mega-launcher', display_name: 'Mega Launcher', slot: 1, is_hidden: false }],
  'beedrill-mega': [{ pokemon_id: 'beedrill-mega', ability_id: 'adaptability', display_name: 'Adaptability', slot: 1, is_hidden: false }],
  'pidgeot-mega': [{ pokemon_id: 'pidgeot-mega', ability_id: 'no-guard', display_name: 'No Guard', slot: 1, is_hidden: false }],
  'alakazam-mega': [{ pokemon_id: 'alakazam-mega', ability_id: 'trace', display_name: 'Trace', slot: 1, is_hidden: false }],
  'slowbro-mega': [{ pokemon_id: 'slowbro-mega', ability_id: 'shell-armor', display_name: 'Shell Armor', slot: 1, is_hidden: false }],
  'gengar-mega': [{ pokemon_id: 'gengar-mega', ability_id: 'shadow-tag', display_name: 'Shadow Tag', slot: 1, is_hidden: false }],
  'kangaskhan-mega': [{ pokemon_id: 'kangaskhan-mega', ability_id: 'parental-bond', display_name: 'Parental Bond', slot: 1, is_hidden: false }],
  'pinsir-mega': [{ pokemon_id: 'pinsir-mega', ability_id: 'aerilate', display_name: 'Aerilate', slot: 1, is_hidden: false }],
  'gyarados-mega': [{ pokemon_id: 'gyarados-mega', ability_id: 'mold-breaker', display_name: 'Mold Breaker', slot: 1, is_hidden: false }],
  'aerodactyl-mega': [{ pokemon_id: 'aerodactyl-mega', ability_id: 'tough-claws', display_name: 'Tough Claws', slot: 1, is_hidden: false }],
  'mewtwo-mega-x': [{ pokemon_id: 'mewtwo-mega-x', ability_id: 'steadfast', display_name: 'Steadfast', slot: 1, is_hidden: false }],
  'mewtwo-mega-y': [{ pokemon_id: 'mewtwo-mega-y', ability_id: 'insomnia', display_name: 'Insomnia', slot: 1, is_hidden: false }],
  'ampharos-mega': [{ pokemon_id: 'ampharos-mega', ability_id: 'mold-breaker', display_name: 'Mold Breaker', slot: 1, is_hidden: false }],
  'steelix-mega': [{ pokemon_id: 'steelix-mega', ability_id: 'sand-force', display_name: 'Sand Force', slot: 1, is_hidden: false }],
  'scizor-mega': [{ pokemon_id: 'scizor-mega', ability_id: 'technician', display_name: 'Technician', slot: 1, is_hidden: false }],
  'heracross-mega': [{ pokemon_id: 'heracross-mega', ability_id: 'skill-link', display_name: 'Skill Link', slot: 1, is_hidden: false }],
  'houndoom-mega': [{ pokemon_id: 'houndoom-mega', ability_id: 'solar-power', display_name: 'Solar Power', slot: 1, is_hidden: false }],
  'tyranitar-mega': [{ pokemon_id: 'tyranitar-mega', ability_id: 'sand-stream', display_name: 'Sand Stream', slot: 1, is_hidden: false }],
  'sceptile-mega': [{ pokemon_id: 'sceptile-mega', ability_id: 'lightning-rod', display_name: 'Lightning Rod', slot: 1, is_hidden: false }],
  'blaziken-mega': [{ pokemon_id: 'blaziken-mega', ability_id: 'speed-boost', display_name: 'Speed Boost', slot: 1, is_hidden: false }],
  'swampert-mega': [{ pokemon_id: 'swampert-mega', ability_id: 'swift-swim', display_name: 'Swift Swim', slot: 1, is_hidden: false }],
  'gardevoir-mega': [{ pokemon_id: 'gardevoir-mega', ability_id: 'pixilate', display_name: 'Pixilate', slot: 1, is_hidden: false }],
  'sableye-mega': [{ pokemon_id: 'sableye-mega', ability_id: 'magic-bounce', display_name: 'Magic Bounce', slot: 1, is_hidden: false }],
  'mawile-mega': [{ pokemon_id: 'mawile-mega', ability_id: 'huge-power', display_name: 'Huge Power', slot: 1, is_hidden: false }],
  'aggron-mega': [{ pokemon_id: 'aggron-mega', ability_id: 'filter', display_name: 'Filter', slot: 1, is_hidden: false }],
  'medicham-mega': [{ pokemon_id: 'medicham-mega', ability_id: 'pure-power', display_name: 'Pure Power', slot: 1, is_hidden: false }],
  'manectric-mega': [{ pokemon_id: 'manectric-mega', ability_id: 'intimidate', display_name: 'Intimidate', slot: 1, is_hidden: false }],
  'sharpedo-mega': [{ pokemon_id: 'sharpedo-mega', ability_id: 'strong-jaw', display_name: 'Strong Jaw', slot: 1, is_hidden: false }],
  'camerupt-mega': [{ pokemon_id: 'camerupt-mega', ability_id: 'sheer-force', display_name: 'Sheer Force', slot: 1, is_hidden: false }],
  'altaria-mega': [{ pokemon_id: 'altaria-mega', ability_id: 'pixilate', display_name: 'Pixilate', slot: 1, is_hidden: false }],
  'banette-mega': [{ pokemon_id: 'banette-mega', ability_id: 'prankster', display_name: 'Prankster', slot: 1, is_hidden: false }],
  'absol-mega': [{ pokemon_id: 'absol-mega', ability_id: 'magic-bounce', display_name: 'Magic Bounce', slot: 1, is_hidden: false }],
  'glalie-mega': [{ pokemon_id: 'glalie-mega', ability_id: 'refrigerate', display_name: 'Refrigerate', slot: 1, is_hidden: false }],
  'salamence-mega': [{ pokemon_id: 'salamence-mega', ability_id: 'aerilate', display_name: 'Aerilate', slot: 1, is_hidden: false }],
  'metagross-mega': [{ pokemon_id: 'metagross-mega', ability_id: 'tough-claws', display_name: 'Tough Claws', slot: 1, is_hidden: false }],
  'latias-mega': [{ pokemon_id: 'latias-mega', ability_id: 'levitate', display_name: 'Levitate', slot: 1, is_hidden: false }],
  'latios-mega': [{ pokemon_id: 'latios-mega', ability_id: 'levitate', display_name: 'Levitate', slot: 1, is_hidden: false }],
  'rayquaza-mega': [{ pokemon_id: 'rayquaza-mega', ability_id: 'delta-stream', display_name: 'Delta Stream', slot: 1, is_hidden: false }],
  'lopunny-mega': [{ pokemon_id: 'lopunny-mega', ability_id: 'scrappy', display_name: 'Scrappy', slot: 1, is_hidden: false }],
  'garchomp-mega': [{ pokemon_id: 'garchomp-mega', ability_id: 'sand-force', display_name: 'Sand Force', slot: 1, is_hidden: false }],
  'lucario-mega': [{ pokemon_id: 'lucario-mega', ability_id: 'adaptability', display_name: 'Adaptability', slot: 1, is_hidden: false }],
  'abomasnow-mega': [{ pokemon_id: 'abomasnow-mega', ability_id: 'snow-warning', display_name: 'Snow Warning', slot: 1, is_hidden: false }],
  'gallade-mega': [{ pokemon_id: 'gallade-mega', ability_id: 'inner-focus', display_name: 'Inner Focus', slot: 1, is_hidden: false }],
  'audino-mega': [{ pokemon_id: 'audino-mega', ability_id: 'healer', display_name: 'Healer', slot: 1, is_hidden: false }],
  'diancie-mega': [{ pokemon_id: 'diancie-mega', ability_id: 'magic-bounce', display_name: 'Magic Bounce', slot: 1, is_hidden: false }],
};
const NON_BATTLE_ITEM_PATTERN = /(catch|catching|bonus|standard-balls|special-balls|apricorn-balls|razz|nanab|pinap|tm|hm|tr|technical|machine|mail|letter|mulch|fossil|apricorn|shard|repel|escape|rope|rod|bike|bicycle|ticket|pass|key|card|parcel|souvenir|photo|flute|doll|honey|nectar|exp\.?\s*share|exp-share|experience|candy|rare-candy|incense|memory|memories|medicine|healing|revival|revive|beleber|potion|trank|restore|genesung|status-cures|full-heal|heiler|antidote|ether|elixir|pp-recovery|pp-up|pp-max|ap-plus|vitamin|vitamins|stat-boosts|x-attack|x-defense|x-speed|x-sp-atk|x-sp-def|x-accuracy|dire-hit|guard-spec)/i;
const BATTLE_ITEM_CATEGORY_PATTERN = /(held|battle|berry|berries|mega|plate|drive|z-crystal|choice|type-enhancement|species-specific)/i;
const RULE_PROFILE_LABELS = {
  open: 'Open Sheet',
  current: 'Aktuelle Generation',
  champions: 'Pokémon Champions',
};

function pageError(title, text) {
  return `<section class="builder-empty error"><strong>${esc(title)}</strong><span>${esc(text)}</span></section>`;
}

function selectOptions(entries = [], current = '', labeler = entry => entry.display_name, valueKey = 'display_name') {
  const options = ['<option value="">Keine Auswahl</option>'];
  entries.forEach(entry => {
    const value = entry[valueKey] || entry.display_name || '';
    options.push(`<option value="${esc(value)}" ${value === current ? 'selected' : ''}${pickerOptionAttrs(entry, value)}>${esc(labeler(entry))}</option>`);
  });
  if (current && !entries.some(entry => (entry[valueKey] || entry.display_name) === current)) {
    options.push(`<option value="${esc(current)}" selected data-missing="true">${esc(current)} · nicht im Profil</option>`);
  }
  return options.join('');
}

function groupItemOptions(items = [], current = '') {
  const groups = new Map();
  items.forEach(item => {
    const category = itemCategoryLabel(item);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  const body = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'de')).map(([category, entries]) => (
    `<optgroup label="${esc(category)}">${entries.map(item => `<option value="${esc(item.display_name)}" ${item.display_name === current ? 'selected' : ''}${pickerOptionAttrs(item, item.display_name)}>${esc(catalogDisplayName(item, item.display_name))}</option>`).join('')}</optgroup>`
  )).join('');
  const missing = current && !items.some(item => item.display_name === current) ? `<option value="${esc(current)}" selected>${esc(current)} · nicht im Profil</option>` : '';
  return `<option value="">Kein Item</option>${missing}${body}`;
}

function isCombatItem(item = {}) {
  const haystack = [item.id, item.display_name, item.german_name, item.category, item.champions_category].filter(Boolean).join(' ');
  if (NON_BATTLE_ITEM_PATTERN.test(haystack)) return false;
  if (item.is_battle_relevant === true || item.is_champions_legal === true) return true;
  return BATTLE_ITEM_CATEGORY_PATTERN.test(haystack);
}

function combatItems(items = []) {
  const filtered = items.filter(isCombatItem);
  const fallback = items.filter(item => !NON_BATTLE_ITEM_PATTERN.test([item.id, item.display_name, item.german_name, item.category].filter(Boolean).join(' ')));
  return dedupeItemsByName(filtered.length ? filtered : fallback);
}

function itemDedupeKey(item = {}) {
  return String(item.german_name || item.display_name || item.english_name || item.id || '').trim().toLowerCase();
}

function itemQualityScore(item = {}) {
  let score = 0;
  if (item.id && !String(item.id).startsWith('champions-')) score += 8;
  if (item.category) score += 4;
  if (item.german_name) score += 2;
  if (item.short_effect || item.effect_text) score += 1;
  return score;
}

function dedupeItemsByName(items = []) {
  const deduped = new Map();
  items.forEach(item => {
    const key = itemDedupeKey(item);
    if (!key) return;
    const current = deduped.get(key);
    if (!current || itemQualityScore(item) > itemQualityScore(current)) deduped.set(key, item);
  });
  return [...deduped.values()].sort((a, b) => catalogDisplayName(a).localeCompare(catalogDisplayName(b), 'de'));
}

function itemCategoryLabel(item = {}) {
  const id = String(item.id || '').toLowerCase();
  const raw = String(item.champions_category || item.category || '').toLowerCase();
  const text = [id, raw, item.display_name, item.german_name, item.english_name].filter(Boolean).join(' ').toLowerCase();
  if (id.endsWith('-berry') || raw.includes('berr')) return 'Beeren';
  if (raw.includes('mega') || id.endsWith('ite')) return 'Mega-Steine';
  if (raw.includes('z-crystal')) return 'Z-Kristalle';
  if (raw.includes('plate')) return 'Tafeln';
  if (raw.includes('choice') || text.includes('choice') || text.includes('wahl')) return 'Wahlitems';
  if (raw.includes('type-enhancement')) return 'Typ-Boosts';
  if (raw.includes('species-specific')) return 'Spezies-Items';
  if (raw.includes('bad-held') || text.includes(' orb') || text.includes('-orb') || text.includes('heissorb') || text.includes('toxik-orb')) return 'Risiko-Items';
  if (raw.includes('held') || raw.includes('battle')) return 'Kampfitems';
  if (raw) return 'Weitere Kampfitems';
  return 'Weitere Kampfitems';
}

function natureOptions(current = '') {
  const normalized = String(current || '').trim().toLowerCase();
  const options = ['<option value="">Keine Auswahl</option>'];
  NATURE_OPTIONS.forEach(([value, de, up, down]) => {
    const selected = value.toLowerCase() === normalized || de.toLowerCase() === normalized;
    const effect = up && down ? `+${STAT_LABELS[up]} / -${STAT_LABELS[down]}` : 'neutral';
    options.push(`<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(de)} / ${esc(value)} - ${esc(effect)}</option>`);
  });
  if (current && !NATURE_OPTIONS.some(([value, de]) => value.toLowerCase() === normalized || de.toLowerCase() === normalized)) {
    options.push(`<option value="${esc(current)}" selected>${esc(current)} - nicht in der Liste</option>`);
  }
  return options.join('');
}

function natureEffect(current = '') {
  const normalized = String(current || '').trim().toLowerCase();
  const match = NATURE_OPTIONS.find(([value, de]) => value.toLowerCase() === normalized || de.toLowerCase() === normalized);
  return match ? { up: match[2], down: match[3] } : { up: null, down: null };
}

function pokemonDisplayName(entry = null, fallback = '') {
  const en = entry?.pokemon_name || fallback || '';
  const de = entry?.german_name || '';
  return de && de !== en ? `${de} (${en})` : en;
}

function catalogDisplayName(entry = null, fallback = '') {
  return entry?.german_name || entry?.display_name || entry?.english_name || entry?.pokemon_name || fallback || '';
}

function catalogEnglishName(entry = null) {
  return entry?.english_name || (entry?.german_name && entry?.display_name !== entry.german_name ? entry?.display_name : '') || '';
}

function catalogAliasText(entry = null) {
  const display = catalogDisplayName(entry);
  const english = catalogEnglishName(entry);
  return english && english !== display ? english : '';
}

function searchTextForEntry(entry = null, fallback = '') {
  return [
    fallback,
    entry?.id,
    entry?.move_id,
    entry?.ability_id,
    entry?.display_name,
    entry?.english_name,
    entry?.german_name,
    entry?.pokemon_name,
    ...(entry?.search_names || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function catalogEntryMatchesValue(entry, value) {
  return Boolean(value) && [entry?.display_name, entry?.german_name, entry?.english_name, entry?.id, entry?.move_id, entry?.ability_id].filter(Boolean).includes(value);
}

function makeCatalogMap(catalog, forms) {
  const map = new Map();
  catalog.forEach(mon => map.set(mon.pokemon_id, mon));
  forms.forEach(form => map.set(form.pokemon_id, form));
  return map;
}

function importedMegaBaseEntry(mon, catalogMap) {
  const candidates = [];
  const id = String(mon?.pokemon_id || '');
  const name = String(mon?.pokemon_name || '');
  if (id.startsWith('mega-')) candidates.push(id.replace(/^mega-/, ''));
  if (/^Mega\s+/i.test(name)) candidates.push(toPokemonId(name.replace(/^Mega\s+/i, '')));
  return candidates.map(candidate => catalogMap.get(candidate)).find(Boolean) || null;
}

function selectedFormFor(mon, formsBySpecies) {
  const formId = mon?.form_pokemon_id || mon?.pokemon_id;
  return (formsBySpecies.get(mon?.pokemon_id) || []).find(form => form.pokemon_id === formId) || null;
}

function formChoicesFor(mon, formsBySpecies, catalogEntry, mode = 'standard') {
  const base = {
    ...(catalogEntry || {}),
    pokemon_id: mon.pokemon_id,
    species_pokemon_id: mon.pokemon_id,
    pokemon_name: catalogEntry?.pokemon_name || mon.pokemon_name,
    german_name: catalogEntry?.german_name,
    is_default: true,
    is_mega: false,
    is_champions_legal: catalogEntry?.is_champions_legal !== false,
  };
  const forms = [base, ...(formsBySpecies.get(mon.pokemon_id) || [])]
    .filter(form => mode !== 'champions' || form.is_champions_legal !== false);
  const deduped = new Map();
  forms.forEach(form => {
    if (form?.pokemon_id && !deduped.has(form.pokemon_id)) deduped.set(form.pokemon_id, form);
  });
  return [...deduped.values()].sort((a, b) => {
    if (a.pokemon_id === mon.pokemon_id) return -1;
    if (b.pokemon_id === mon.pokemon_id) return 1;
    return Number(Boolean(a.is_mega)) - Number(Boolean(b.is_mega)) || String(a.pokemon_name).localeCompare(String(b.pokemon_name), 'de');
  });
}

function formOptionsDisplayFor(mon, formsBySpecies, catalogEntry, mode = 'standard') {
  const forms = formChoicesFor(mon, formsBySpecies, catalogEntry, mode);
  if (!forms.length) return '';
  const current = mon.form_pokemon_id || mon.pokemon_id;
  return `<label class="builder-field"><span>Form / Mega</span><select class="form-select" id="builder-form">${forms.map(form => `<option value="${esc(form.pokemon_id)}" ${form.pokemon_id === current ? 'selected' : ''}>${esc(pokemonDisplayName(form, form.pokemon_name))}${form.is_mega ? ' - Mega' : ' - Normal'}</option>`).join('')}</select></label>`;
}

function megaStoneCandidates(form) {
  const id = String(form?.pokemon_id || '');
  const name = String(form?.pokemon_name || '');
  if (!form?.is_mega) return [];
  const suffix = id.endsWith('-mega-x') || /\bX\b/i.test(name) ? ' X' : id.endsWith('-mega-y') || /\bY\b/i.test(name) ? ' Y' : '';
  const base = name.replace(/^Mega\s+/i, '').replace(/\s+X$/i, '').replace(/\s+Y$/i, '').trim();
  return [
    `${base}nit${suffix}`,
    `${base}it${suffix}`,
    `${base}ite${suffix}`,
    `${base}nit${suffix}`.replace(/\s+/g, ''),
    `${base}ite${suffix}`.replace(/\s+/g, ''),
  ].filter(Boolean);
}

function findMegaStone(form, items = []) {
  const candidates = megaStoneCandidates(form).map(item => item.toLowerCase());
  return items.find(item => {
    const values = [item.display_name, item.german_name, item.id].filter(Boolean).map(value => String(value).toLowerCase());
    return values.some(value => candidates.includes(value) || candidates.some(candidate => value.includes(candidate)));
  }) || null;
}

function compactKey(value = '') {
  return toPokemonId(value).replace(/-/g, '');
}

function megaFormForItem(mon, formsBySpecies, items = []) {
  const itemKey = compactKey(mon?.item || '');
  if (!itemKey) return null;
  return (formsBySpecies.get(mon?.pokemon_id) || []).find(form => {
    if (!form.is_mega) return false;
    return megaStoneCandidates(form).some(candidate => compactKey(candidate) === itemKey);
  }) || null;
}

function effectiveFormFor(mon, formsBySpecies, items = []) {
  const explicit = selectedFormFor(mon, formsBySpecies);
  if (explicit) return explicit;
  return megaFormForItem(mon, formsBySpecies, items);
}

function statsEntryFor(preferredEntry, fallbackEntry) {
  return getBaseStats(preferredEntry) ? preferredEntry : fallbackEntry;
}

function effectiveTeamEntry(mon, catalogMap, formsBySpecies, items = []) {
  const baseEntry = catalogMap.get(mon?.pokemon_id);
  const explicitEntry = catalogMap.get(mon?.form_pokemon_id);
  const inferredForm = effectiveFormFor(mon, formsBySpecies, items);
  return statsEntryFor(inferredForm || explicitEntry || baseEntry, baseEntry);
}

function effectiveTeamMon(mon, catalogMap, formsBySpecies, items = []) {
  const entry = effectiveTeamEntry(mon, catalogMap, formsBySpecies, items);
  return entry?.pokemon_id ? { ...mon, form_pokemon_id: entry.pokemon_id } : mon;
}

function defaultAbilityFor(mon, pokemonAbilities) {
  const formId = mon?.form_pokemon_id || mon?.pokemon_id;
  const direct = [...pokemonAbilities.filter(entry => entry.pokemon_id === formId), ...(ABILITY_OVERRIDES[formId] || [])];
  const scoped = direct.length ? direct : [...pokemonAbilities.filter(entry => entry.pokemon_id === mon?.pokemon_id), ...(ABILITY_OVERRIDES[mon?.pokemon_id] || [])];
  return scoped.find(entry => !entry.is_hidden) || scoped[0] || null;
}

function typeChips(entry = null) {
  const types = Array.isArray(entry?.types) ? entry.types : [];
  if (!types.length) return '';
  return `<div class="builder-type-row">${types.map(type => `<span class="type-chip type-${esc(type)}">${esc(TYPE_LABELS[type] || type)}</span>`).join('')}</div>`;
}

function statsMarkup(stats, missingText = 'Stats fehlen im Katalog', nature = '') {
  if (!stats) return `<div class="builder-stats-missing">${esc(missingText)}</div>`;
  const { up, down } = natureEffect(nature);
  return `<div class="builder-stat-grid">${STAT_KEYS.map(key => {
    const tone = key === up ? ' boosted' : key === down ? ' reduced' : '';
    return `<div class="builder-stat${tone}"><span>${STAT_LABELS[key]}</span><strong>${stats[key]}</strong></div>`;
  }).join('')}</div>`;
}

function statToneClass(key) {
  return String(key || '').toLowerCase();
}

function baseStatsFor(entry = null) {
  return getBaseStats(entry);
}

function bstFor(entry = null) {
  const stats = baseStatsFor(entry);
  return stats ? STAT_KEYS.reduce((sum, key) => sum + stats[key], 0) : null;
}

function hasMegaForm(mon, formsBySpecies) {
  return (formsBySpecies.get(mon?.pokemon_id) || []).some(form => form.is_mega);
}

function addCatalogSortLabel(sortKey) {
  return {
    name: 'Name',
    bst: 'BST',
    HP: 'KP',
    Atk: 'Angriff',
    Def: 'Verteidigung',
    SpA: 'Sp. Angriff',
    SpD: 'Sp. Verteidigung',
    Spe: 'Initiative',
  }[sortKey] || 'Name';
}

function addCatalogCandidates(catalog, pokemon, mode, formsBySpecies, filters = {}) {
  const existing = new Set(pokemon.map(mon => mon.pokemon_id));
  const search = String(filters.search || '').trim().toLowerCase();
  const type = filters.type || 'all';
  const mega = filters.mega || 'all';
  const sort = filters.sort || 'name';
  const candidates = filterCatalogForMode(catalog, mode).filter(mon => {
    if (existing.has(mon.pokemon_id)) return false;
    const types = Array.isArray(mon.types) ? mon.types : [];
    const megaAvailable = hasMegaForm(mon, formsBySpecies);
    const haystack = [mon.pokemon_name, mon.german_name, ...types.map(item => TYPE_LABELS[item] || item)].filter(Boolean).join(' ').toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (type !== 'all' && !types.includes(type)) return false;
    if (mega === 'with' && !megaAvailable) return false;
    if (mega === 'without' && megaAvailable) return false;
    return true;
  });

  return candidates.sort((a, b) => {
    if (sort === 'name') return pokemonDisplayName(a, a.pokemon_name).localeCompare(pokemonDisplayName(b, b.pokemon_name), 'de');
    if (sort === 'bst') return (bstFor(b) ?? -1) - (bstFor(a) ?? -1) || pokemonDisplayName(a, a.pokemon_name).localeCompare(pokemonDisplayName(b, b.pokemon_name), 'de');
    if (STAT_KEYS.includes(sort)) {
      const aStats = baseStatsFor(a);
      const bStats = baseStatsFor(b);
      return (bStats?.[sort] ?? -1) - (aStats?.[sort] ?? -1) || (bstFor(b) ?? -1) - (bstFor(a) ?? -1);
    }
    return 0;
  });
}

function isChampionsLegalEntry(entry = null) {
  return entry?.is_champions_legal === true;
}

function addPokemonResultMarkup(mon, formsBySpecies) {
  const displayName = pokemonDisplayName(mon, mon.pokemon_name);
  const stats = baseStatsFor(mon);
  const bst = bstFor(mon);
  const megaAvailable = hasMegaForm(mon, formsBySpecies);
  return `<button type="button" class="builder-add-result" data-pokemon-id="${esc(mon.pokemon_id)}" onclick="window.builderAddPokemonFromCatalog(this.dataset.pokemonId)">
    <img ${spriteAttrs(mon.pokemon_name)} alt="${esc(displayName)}">
    <div class="builder-add-result-main">
      <strong>${esc(displayName)}</strong>
      ${typeChips(mon)}
      <small>${megaAvailable ? 'Mega verfuegbar' : 'Keine Mega-Form'}</small>
    </div>
    <div class="builder-add-statline">
      ${STAT_KEYS.map(key => `<span><b>${STAT_LABELS[key]}</b><em>${stats?.[key] ?? '-'}</em></span>`).join('')}
      <span class="builder-add-bst"><b>BST</b><em>${bst ?? '-'}</em></span>
    </div>
  </button>`;
}

function addPokemonResultsMarkup(candidates, formsBySpecies) {
  return candidates.map(mon => addPokemonResultMarkup(mon, formsBySpecies)).join('') || '<div class="builder-empty-inline">Keine Treffer. Filter oder Suche anpassen.</div>';
}

function addPokemonResultsClass(count = 0) {
  return `builder-add-results${count <= 6 ? ' compact' : ''}`;
}

function spreadInputs(prefix, spread, max, cssClass) {
  return `<div class="builder-spread-grid">${STAT_KEYS.map(key => {
    const value = Number(spread?.[key]) || 0;
    return `<label><span>${STAT_LABELS[key]}</span><input class="form-input ${cssClass}" id="${prefix}-${key}" type="number" min="0" max="${max}" step="1" value="${value}"></label>`;
  }).join('')}</div>`;
}

function renderSlots(pokemon, selectedId, editable) {
  const slots = pokemon.map((mon, index) => `<button class="builder-slot ${mon.id === selectedId ? 'active' : ''}" onclick="window.builderSelectPokemon('${mon.id}')">
    <span class="builder-slot-index">${index + 1}</span><img ${spriteAttrs(mon.pokemon_name)} alt="${esc(mon.pokemon_name)}"><strong>${esc(mon.pokemon_name)}</strong>
  </button>`);
  while (slots.length < 6) slots.push(`<div class="builder-slot empty"><span class="builder-slot-index">${slots.length + 1}</span><strong>Frei</strong></div>`);
  return `<aside class="builder-sidebar"><div class="builder-panel-title"><span>Team</span><strong>${pokemon.length}/6</strong></div><div class="builder-slots">${slots.join('')}</div>${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.builderShowAddPokemon()">Pokémon hinzufügen</button>' : ''}</aside>`;
}

function miniStatBars(mon, entry, sheet) {
  const mode = sheet.team_mode || 'standard';
  const calculated = calculatePokemonStats(mon, entry, { mode });
  if (!calculated) return '';
  const benchmark = calculatePokemonStats({
    ...mon,
    nature: '',
    evs: {},
    ivs: {},
    dvs: {},
  }, entry, { mode });
  return `<div class="builder-slot-bars">${STAT_KEYS.map(key => {
    const delta = benchmark ? calculated[key] - benchmark[key] : 0;
    const width = Math.max(8, Math.min(100, Math.round((calculated[key] / 220) * 100)));
    const deltaLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0';
    const deltaClass = delta > 0 ? ' up' : delta < 0 ? ' down' : '';
    const title = `${STAT_LABELS[key]} aktuell ${calculated[key]} · Verteilung/Wesen ${deltaLabel}`;
    return `<span class="stat-${statToneClass(key)}" title="${esc(title)}"><b>${STAT_LABELS[key]}</b><i style="width:${width}%"></i><em>${calculated[key]}</em><small class="${deltaClass}">${deltaLabel}</small></span>`;
  }).join('')}</div>`;
}

function renderTeamStrip(pokemon, selectedId, editable, catalogMap, sheet, formsBySpecies, items = []) {
  const slots = [];
  for (let index = 0; index < 6; index++) {
    const mon = pokemon[index];
    if (!mon) {
      slots.push(`<button class="builder-slot empty" ${editable ? 'onclick="window.builderShowAddPokemon()"' : 'disabled'}>
        <span class="builder-slot-index">${index + 1}</span><strong>+</strong><small>Pokemon hinzufuegen</small>
      </button>`);
      continue;
    }
    const entry = effectiveTeamEntry(mon, catalogMap, formsBySpecies, items);
    const baseEntry = catalogMap.get(mon.pokemon_id);
    const spriteName = entry?.pokemon_name || mon.pokemon_name;
    const displayName = pokemonDisplayName(entry, mon.pokemon_name);
    slots.push(`<button class="builder-slot ${mon.id === selectedId ? 'active' : ''}" onclick="window.builderSelectPokemon('${mon.id}')">
      <span class="builder-slot-index">${index + 1}</span>
      <img ${spriteAttrs(spriteName)} alt="${esc(displayName)}">
      <span class="builder-slot-copy"><strong>${esc(displayName)}</strong>${typeChips(entry)}<small>${esc(mon.item || 'Kein Item')}${mon.ability ? ` · ${esc(mon.ability)}` : ''}</small></span>
      ${miniStatBars(effectiveTeamMon(mon, catalogMap, formsBySpecies, items), entry, sheet)}
    </button>`);
  }
  return `<section class="builder-team-strip"><div class="builder-panel-title"><span>Team</span><strong>${pokemon.length}/6</strong></div><div class="builder-slots">${slots.join('')}</div></section>`;
}

function filterCatalogForMode(catalog, mode) {
  if (mode !== 'champions') return catalog;
  return catalog.filter(isChampionsLegalEntry);
}

function championsLegalityMessage(mon, catalogMap) {
  const entry = catalogMap.get(mon?.pokemon_id);
  const name = pokemonDisplayName(entry, mon?.pokemon_name || 'Pokemon');
  if (!entry) return `${name} ist nicht im Katalog gefunden und kann nicht als Champions-legal geprueft werden.`;
  if (!isChampionsLegalEntry(entry)) return `${name} ist nicht in Pokemon Champions freigegeben.`;
  return '';
}

function filterReferencesForMode(references, mode) {
  const items = combatItems(references.items || []);
  if (mode === 'champions') {
    const championsItems = items.filter(item => item.is_champions_legal === true || item.is_battle_relevant === true);
    return { ...references, items: championsItems.length ? championsItems : items };
  }
  if (mode === 'current') {
    return { ...references, items };
  }
  return { ...references, items };
}

function ruleProfileForSheet(sheet) {
  if (sheet.rules_profile) return sheet.rules_profile;
  return (sheet.team_mode || 'standard') === 'champions' ? 'champions' : 'open';
}

function filterMovesForProfile(moves, profile) {
  if (profile === 'champions') return moves.filter(move => move.is_champions_legal === true);
  if (profile === 'current') return moves.filter(move => move.is_current_gen_legal === true);
  return moves;
}

function moveLookupKeys(move = {}) {
  return [
    move.id,
    move.move_id,
    move.display_name,
    move.english_name,
    move.german_name,
    ...(move.search_names || []),
  ].filter(Boolean).flatMap(value => {
    const raw = String(value).trim();
    return [raw, raw.toLowerCase(), toPokemonId(raw), compactKey(raw)];
  });
}

function buildMoveMetaMap(moveCatalog = []) {
  const map = new Map();
  moveCatalog.forEach(move => {
    moveLookupKeys(move).forEach(key => {
      if (key && !map.has(key)) map.set(key, move);
    });
  });
  return map;
}

function findMoveMeta(value, metaByKey) {
  if (!value) return null;
  return metaByKey.get(value)
    || metaByKey.get(String(value).toLowerCase())
    || metaByKey.get(toPokemonId(value))
    || metaByKey.get(compactKey(value))
    || null;
}

function moveOptionsFor(mon, pokemonMoves, moveCatalog, profile) {
  const formId = mon.form_pokemon_id || mon.pokemon_id;
  const direct = pokemonMoves.filter(entry => entry.pokemon_id === formId);
  const species = pokemonMoves.filter(entry => entry.pokemon_id === mon.pokemon_id);
  const sourceMoves = formId !== mon.pokemon_id ? [...species, ...direct] : (direct.length ? direct : species);
  const scoped = filterMovesForProfile(sourceMoves, profile);
  const metaByKey = buildMoveMetaMap(moveCatalog);
  const base = scoped.length
    ? scoped.map(move => {
      const meta = findMoveMeta(move.move_id, metaByKey) || findMoveMeta(move.display_name, metaByKey) || {};
      return {
        ...meta,
        ...move,
        display_name: move.german_name || meta.german_name || move.display_name || meta.display_name,
        english_name: move.english_name || meta.english_name || meta.display_name,
        german_name: move.german_name || meta.german_name,
        search_names: [...(meta.search_names || []), ...(move.search_names || [])],
      };
    })
    : moveCatalog;
  const deduped = new Map();
  [...base, ...(mon.moves || []).map(moveName => ({ ...(findMoveMeta(moveName, metaByKey) || {}), display_name: moveName, move_id: findMoveMeta(moveName, metaByKey)?.id || moveName }))].forEach(move => {
    const key = move.display_name || move.move_id || move.id;
    if (key && !deduped.has(key)) deduped.set(key, move);
  });
  return [...deduped.values()].sort((a, b) => String(a.display_name).localeCompare(String(b.display_name), 'de'));
}

function moveOptionLabel(move) {
  const parts = [catalogDisplayName(move, move.display_name)];
  const alias = catalogAliasText(move);
  if (alias) parts.push(alias);
  if (move.type) parts.push(TYPE_LABELS[move.type] || move.type);
  if (move.power != null) parts.push(`${move.power} BP`);
  return parts.filter(Boolean).join(' · ');
}

function pickerInfoText(entry, fallback = '') {
  return entry?.short_effect || entry?.effect_text || fallback || '';
}

function pickerInfoAttr(entry) {
  const text = pickerInfoText(entry);
  return text ? ` data-info="${esc(text)}"` : '';
}

function pickerOptionAttrs(entry, fallback = '') {
  const attrs = [
    pickerInfoAttr(entry),
    ` data-search="${esc(searchTextForEntry(entry, fallback))}"`,
    ` data-display="${esc(catalogDisplayName(entry, fallback))}"`,
  ];
  const alias = catalogAliasText(entry);
  if (alias) attrs.push(` data-alias="${esc(alias)}"`);
  if (entry?.type) attrs.push(` data-move-type="${esc(entry.type)}"`);
  if (entry?.damage_class) attrs.push(` data-move-class="${esc(entry.damage_class)}"`);
  if (entry?.power != null) attrs.push(` data-move-power="${esc(entry.power)}"`);
  if (entry?.accuracy != null) attrs.push(` data-move-accuracy="${esc(entry.accuracy)}"`);
  if (entry?.pp != null) attrs.push(` data-move-pp="${esc(entry.pp)}"`);
  return attrs.filter(Boolean).join('');
}

function selectedInfo(entries, value, id, fallback = '') {
  const entry = value ? entries.find(item => catalogEntryMatchesValue(item, value)) : null;
  const text = pickerInfoText(entry, fallback);
  return `<small class="builder-picker-help" id="${id}">${esc(text)}</small>`;
}

function choiceTitle(option) {
  return option?.dataset?.display || option?.value || option?.textContent?.trim() || '';
}

function choiceSummaryFromOption(option, kind = 'item', context = 'card') {
  if (!option?.value) {
    return kind === 'move'
      ? '<strong>Move auswaehlen</strong><small>Noch kein Move gesetzt</small>'
      : '<strong>Item auswaehlen</strong><small>Kein Item gesetzt</small>';
  }
  const title = choiceTitle(option);
  if (kind === 'move') {
    const type = option.dataset.moveType || '';
    const moveClass = option.dataset.moveClass || '';
    const power = option.dataset.movePower || '-';
    const accuracy = option.dataset.moveAccuracy || '-';
    const typeLabel = type ? (TYPE_LABELS[type] || type) : 'Typ offen';
    const alias = option.dataset.alias || '';
    if (context === 'card') {
      return `<strong>${esc(title)}</strong><small>${alias ? esc(alias) : 'Move gesetzt'}</small>`;
    }
    return `<strong>${esc(title)}</strong><small>${alias ? `${esc(alias)} &middot; ` : ''}<span class="type-chip ${type ? `type-${esc(type)}` : ''}">${esc(typeLabel)}</span>${moveClass ? ` ${esc(moveClass)}` : ''} &middot; BP ${esc(power)} &middot; Acc ${esc(accuracy)}</small>`;
  }
  const group = option.parentElement?.label || 'Item';
  const text = option.dataset.info || 'Keine Beschreibung hinterlegt.';
  const alias = option.dataset.alias || '';
  return `<strong>${esc(title)}</strong><small>${alias ? `${esc(alias)} &middot; ` : ''}${esc(group)}${context === 'card' ? '' : ` &middot; ${esc(text)}`}</small>`;
}

function selectedChoiceCard(entries, value, fieldId, kind = 'item', editable = true) {
  const entry = value ? entries.find(item => catalogEntryMatchesValue(item, value)) : null;
  const selected = entry
    ? {
      value: catalogDisplayName(entry, entry.display_name || entry.move_id || entry.id),
      dataset: {
        moveType: entry.type || '',
        moveClass: entry.damage_class || '',
        movePower: entry.power ?? '',
        moveAccuracy: entry.accuracy ?? '',
        info: pickerInfoText(entry),
        alias: catalogAliasText(entry),
        display: catalogDisplayName(entry, entry.display_name || entry.move_id || entry.id),
      },
      parentElement: { label: kind === 'move' ? 'Move' : itemCategoryLabel(entry) },
    }
    : value ? { value, dataset: { info: 'Nicht im aktuellen Profil vorhanden.' }, parentElement: { label: 'Extern' } } : null;
  const label = kind === 'move' ? 'Move auswaehlen' : 'Item auswaehlen';
  return `<button type="button" class="builder-choice-card ${kind === 'move' ? 'builder-move-choice-card' : ''}" data-choice-card-for="${esc(fieldId)}" onclick="window.openBuilderChoicePicker('${esc(fieldId)}','${esc(kind)}')" ${editable ? '' : 'disabled'} aria-label="${esc(label)}">
    ${choiceSummaryFromOption(selected, kind, 'card')}
  </button>`;
}

function moveDetailMarkupFromOption(option) {
  if (!option?.value) return '<span class="builder-move-empty">Noch kein Move gewählt</span>';
  const type = option.dataset.moveType || '';
  const moveClass = option.dataset.moveClass || '';
  const typeLabel = type ? (TYPE_LABELS[type] || type) : 'Typ offen';
  const power = option.dataset.movePower || '—';
  const accuracy = option.dataset.moveAccuracy || '—';
  const pp = option.dataset.movePp || '—';
  const effect = option.dataset.info || (option.dataset.missing ? 'Dieser Move ist im aktuellen Profil nicht vorhanden.' : '');
  return `<div class="builder-move-meta">
      <span class="type-chip ${type ? `type-${esc(type)}` : ''}">${esc(typeLabel)}</span>
      ${moveClass ? `<span>${esc(moveClass)}</span>` : '<span>Status/Info offen</span>'}
      <span>BP <strong>${esc(power)}</strong></span>
      <span>Acc <strong>${esc(accuracy)}</strong></span>
      <span>PP <strong>${esc(pp)}</strong></span>
    </div>
    <p>${esc(effect || 'Keine Beschreibung hinterlegt.')}</p>`;
}

function selectedMoveDetail(entries, value, id) {
  const entry = value ? entries.find(item => catalogEntryMatchesValue(item, value)) : null;
  const selected = entry
    ? {
      value: catalogDisplayName(entry, entry.display_name || entry.move_id || entry.id),
      dataset: {
        moveType: entry.type || '',
        moveClass: entry.damage_class || '',
        movePower: entry.power ?? '',
        moveAccuracy: entry.accuracy ?? '',
        movePp: entry.pp ?? '',
        info: pickerInfoText(entry),
        alias: catalogAliasText(entry),
        display: catalogDisplayName(entry, entry.display_name || entry.move_id || entry.id),
      },
    }
    : value ? { value, dataset: { missing: 'true', info: 'Dieser Move ist im aktuellen Profil nicht vorhanden.' } } : null;
  return `<div class="builder-move-info" id="${id}" aria-live="polite">${moveDetailMarkupFromOption(selected)}</div>`;
}

function updatePickerHelp(select) {
  const helpId = select?.dataset?.pickerHelp;
  if (!helpId) return;
  const help = document.getElementById(helpId);
  if (!help) return;
  help.textContent = select.selectedOptions?.[0]?.dataset?.info || '';
}

function updateMoveDetail(select) {
  const panelId = select?.dataset?.moveDetail;
  if (!panelId) return;
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.innerHTML = moveDetailMarkupFromOption(select.selectedOptions?.[0]);
}

function updateChoiceCard(select) {
  if (!select?.id) return;
  const card = document.querySelector(`[data-choice-card-for="${select.id}"]`);
  if (!card) return;
  const kind = select.dataset.choiceKind || (select.id.includes('move') ? 'move' : 'item');
  card.innerHTML = choiceSummaryFromOption(select.selectedOptions?.[0], kind, 'card');
}

function renderAddPokemon(catalog, pokemon, mode, formsBySpecies) {
  return renderAddPokemonCatalog(catalog, pokemon, mode, formsBySpecies);
  const available = addCatalogCandidates(catalog, pokemon, mode, formsBySpecies);
  return `<section class="builder-card builder-add-card">
    <div><span class="eyebrow">Katalog</span><h2>Pokémon hinzufügen</h2><p>${mode === 'champions' ? 'Es werden nur Champions-legale Pokémon angeboten.' : 'Wähle ein Pokémon aus dem bestehenden Katalog. Formen und Megas stellst du danach im Set ein.'}</p></div>
    <div class="builder-add-row">
      <input class="form-input" id="builder-add-search" type="search" placeholder="Suchen..." oninput="window.builderFilterCatalog()">
      <select class="form-select" id="builder-add-select"><option value="">Pokémon auswählen...</option>${available.map(mon => `<option value="${esc(mon.pokemon_id)}">#${String(mon.dex_number || '').padStart(3, '0')} ${esc(pokemonDisplayName(mon, mon.pokemon_name))}</option>`).join('')}</select>
      <button class="btn btn-primary" onclick="window.builderAddPokemon()" ${available.length ? '' : 'disabled'}>Hinzufügen</button>
    </div>
    <small id="builder-add-count">${available.length} verfügbar</small>
  </section>`;
}

function renderAddPokemonCatalog(catalog, pokemon, mode, formsBySpecies) {
  const available = addCatalogCandidates(catalog, pokemon, mode, formsBySpecies);
  return `<section class="builder-card builder-add-card">
    <div class="builder-add-head">
      <div><span class="eyebrow">Katalog</span><h2>Pokemon hinzufuegen</h2><p>${mode === 'champions' ? 'Es werden nur Champions-legale Pokemon angeboten.' : 'Formen und Megas stellst du danach im Set ein.'}</p></div>
      <small id="builder-add-count">${available.length} verfuegbar</small>
    </div>
    <div class="builder-add-toolbar">
      <input class="form-input" id="builder-add-search" type="search" placeholder="Name oder Typ suchen..." oninput="window.builderFilterCatalog()">
      <select class="form-select" id="builder-add-sort" onchange="window.builderFilterCatalog()" aria-label="Sortierung">
        <option value="name">${esc(addCatalogSortLabel('name'))}</option>
        <option value="bst">${esc(addCatalogSortLabel('bst'))}</option>
        ${STAT_KEYS.map(key => `<option value="${esc(key)}">${esc(addCatalogSortLabel(key))}</option>`).join('')}
      </select>
      <input type="hidden" id="builder-add-type" value="all">
      <input type="hidden" id="builder-add-mega" value="all">
    </div>
    <div class="builder-add-filter-row" aria-label="Typfilter">
      <button type="button" class="active" data-builder-type="all" onclick="window.builderSetAddType(this.dataset.builderType)">Alle Typen</button>
      ${TYPE_ORDER.map(type => `<button type="button" class="builder-type-filter type-${esc(type)}" data-builder-type="${esc(type)}" onclick="window.builderSetAddType(this.dataset.builderType)">${esc(TYPE_LABELS[type] || type)}</button>`).join('')}
    </div>
    <div class="builder-add-filter-row compact" aria-label="Mega-Filter">
      <button type="button" class="active" data-builder-mega="all" onclick="window.builderSetAddMega(this.dataset.builderMega)">Alle</button>
      <button type="button" data-builder-mega="with" onclick="window.builderSetAddMega(this.dataset.builderMega)">Mit Mega</button>
      <button type="button" data-builder-mega="without" onclick="window.builderSetAddMega(this.dataset.builderMega)">Ohne Mega</button>
    </div>
    <div class="${addPokemonResultsClass(available.length)}" id="builder-add-results">${addPokemonResultsMarkup(available, formsBySpecies)}</div>
  </section>`;
}

function renderBuilderShowdownImport(editable) {
  if (!editable) return '';
  return `<section class="builder-card builder-import-card">
    <div class="builder-import-head">
      <div><span class="eyebrow">Import</span><h2>Showdown einfuegen</h2><p>Ersetzt das aktuelle Team durch den eingefuegten Showdown-Export.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="window.builderToggleShowdownImport()">Schliessen</button>
    </div>
    <textarea class="form-textarea builder-import-textarea" id="builder-showdown-import" placeholder="Pokemon @ Item&#10;Ability: ...&#10;EVs: ...&#10;- Move"></textarea>
    <div class="builder-import-actions">
      <span id="builder-import-status"></span>
      <button class="btn btn-primary btn-sm" onclick="window.builderImportShowdown()">Team uebernehmen</button>
    </div>
  </section>`;
}

function abilityOptionsFor(mon, pokemonAbilities, fallbackAbilities) {
  const formId = mon.form_pokemon_id || mon.pokemon_id;
  const direct = [...pokemonAbilities.filter(entry => entry.pokemon_id === formId), ...(ABILITY_OVERRIDES[formId] || [])];
  const species = [...pokemonAbilities.filter(entry => entry.pokemon_id === mon.pokemon_id), ...(ABILITY_OVERRIDES[mon.pokemon_id] || [])];
  const scoped = direct.length ? direct : species;
  const deduped = new Map();
  (scoped.length ? scoped : fallbackAbilities).forEach(entry => {
    const key = entry.ability_id || entry.id || entry.display_name;
    if (key && !deduped.has(key)) deduped.set(key, entry);
  });
  return [...deduped.values()].sort((a, b) => (Number(a.slot) || 99) - (Number(b.slot) || 99) || String(a.display_name).localeCompare(String(b.display_name), 'de'));
}

function renderEditor(sheet, mon, catalogEntry, baseCatalogEntry, formsBySpecies, references, pokemonAbilities, pokemonMoves, editable, catalogMap = new Map()) {
  if (!mon) return '<section class="builder-card builder-empty"><strong>Kein Pokémon ausgewählt.</strong><span>Wähle links einen Slot aus oder füge ein Pokémon hinzu.</span></section>';
  const mode = sheet.team_mode || 'standard';
  const isChampions = mode === 'champions';
  const profile = ruleProfileForSheet(sheet);
  const moves = [...(mon.moves || [])];
  while (moves.length < 4) moves.push('');
  const filteredReferences = filterReferencesForMode(references, profile);
  const selectedForm = effectiveFormFor(mon, formsBySpecies, filteredReferences.items || []);
  const effectiveMon = selectedForm ? { ...mon, form_pokemon_id: selectedForm.pokemon_id } : mon;
  const displayEntry = selectedForm || catalogEntry;
  const baseStatsEntry = statsEntryFor(displayEntry, baseCatalogEntry || catalogEntry);
  const stats = calculatePokemonStats(effectiveMon, baseStatsEntry, { mode });
  const spriteName = selectedForm?.pokemon_name || mon.pokemon_name;
  const displayName = pokemonDisplayName(displayEntry, mon.pokemon_name);
  const megaStone = findMegaStone(selectedForm, filteredReferences.items || []);
  const abilityOptions = abilityOptionsFor(effectiveMon, pokemonAbilities, references.abilities || []);
  const moveOptions = moveOptionsFor(effectiveMon, pokemonMoves, references.moves || [], profile);
  const evs = normalizeStatSpread(mon.evs, 252, 0);
  const ivs = normalizeStatSpread(mon.ivs, 31, 31);
  const dvs = normalizeStatSpread(mon.dvs, 32, 0);
  const championsWarning = isChampions ? championsLegalityMessage(mon, catalogMap) : '';
  return `<section class="builder-card builder-editor-card">
    <div class="builder-editor-head">
      <div class="builder-editor-identity"><img ${spriteAttrs(spriteName)} alt="${esc(displayName)}"><div><span>${isChampions ? 'Champions-Set' : 'Standard-Set'}</span><h2>${esc(displayName)}</h2>${spriteName !== mon.pokemon_name ? `<small>${esc(mon.pokemon_name)}</small>` : ''}${typeChips(displayEntry || baseStatsEntry)}</div></div>
      ${editable ? `<button class="btn btn-danger btn-sm" onclick="window.builderRemovePokemon('${mon.id}')">Entfernen</button>` : ''}
    </div>
    ${championsWarning ? `<div class="builder-rules-warning"><strong>Champions-Hinweis</strong><span>${esc(championsWarning)}</span></div>` : ''}
    <div class="builder-editor-grid">
      <div class="builder-editor-main">
        <div class="builder-fields">
          <div class="builder-field builder-choice-field"><span>Item</span><select class="form-select builder-picker-select builder-native-choice" id="builder-item" data-picker-help="builder-item-help" data-choice-kind="item" ${editable ? '' : 'disabled'}>${groupItemOptions(filteredReferences.items || [], mon.item || '')}</select>${selectedChoiceCard(filteredReferences.items || [], mon.item, 'builder-item', 'item', editable)}${selectedInfo(filteredReferences.items || [], mon.item, 'builder-item-help')}</div>
          <label class="builder-field"><span>Fähigkeit</span><select class="form-select builder-picker-select" id="builder-ability" data-picker-help="builder-ability-help" ${editable ? '' : 'disabled'}>${selectOptions(abilityOptions, mon.ability || '', ability => `${catalogDisplayName(ability, ability.display_name)}${catalogAliasText(ability) ? ` · ${catalogAliasText(ability)}` : ''}${ability.is_hidden ? ' · Hidden' : ''}`)}</select>${selectedInfo(abilityOptions, mon.ability, 'builder-ability-help')}</label>
          <label class="builder-field builder-field-compact"><span>Wesen</span><select class="form-select" id="builder-nature" ${editable ? '' : 'disabled'}>${natureOptions(mon.nature || '')}</select><small class="builder-picker-help"></small></label>
          ${formOptionsDisplayFor(effectiveMon, formsBySpecies, baseCatalogEntry || catalogEntry, mode)}
          <label class="builder-field builder-field-compact"><span>Level</span><input class="form-input" id="builder-level" type="number" min="1" max="100" value="${isChampions ? 50 : Number(mon.level) || 50}" ${isChampions || !editable ? 'disabled' : ''}><small class="builder-picker-help"></small></label>
        </div>
        <div class="builder-moves">
          <h3>Moves</h3>
          <div class="builder-move-grid">${moves.slice(0, 4).map((move, index) => `<div class="builder-move-field builder-choice-field"><span>Move ${index + 1}</span><select class="form-select builder-picker-select builder-native-choice" id="builder-move-${index}" data-choice-kind="move" data-move-detail="builder-move-${index}-detail" ${editable ? '' : 'disabled'}>${selectOptions(moveOptions, move, moveOptionLabel)}</select>${selectedChoiceCard(moveOptions, move, `builder-move-${index}`, 'move', editable)}${selectedMoveDetail(moveOptions, move, `builder-move-${index}-detail`)}</div>`).join('')}</div>
          <p class="builder-picker-note">${esc(RULE_PROFILE_LABELS[profile] || profile)} · ${moveOptions.length} Moves verfügbar${profile === 'champions' ? ' · Champions-Liste kann später per Override nachgeschärft werden' : ''}</p>
        </div>
      </div>
      <aside class="builder-live-stats">
        <div class="builder-panel-title"><span>Live Stats</span><strong>Lv. ${isChampions ? 50 : Number(mon.level) || 50}</strong></div>
        <div id="builder-stat-preview">${statsMarkup(stats, 'Stats fehlen im Katalog', mon.nature || '')}</div>
      </aside>
    </div>
    <div class="builder-distribution">
      ${isChampions
        ? `<div><h3>Champions-Verteilung</h3><p>0 bis 32 pro Stat. 32 entspricht ungefähr 252 EV.</p>${spreadInputs('builder-dv', dvs, 32, 'builder-dv-input')}<div class="builder-spread-total">Verteilt: <strong id="builder-spread-total">0</strong></div></div>`
        : `<div><h3>EV-Verteilung</h3><p>0 bis 252 pro Stat, maximal 510 insgesamt.</p>${spreadInputs('builder-ev', evs, 252, 'builder-ev-input')}<div class="builder-spread-total">EVs: <strong id="builder-spread-total">0</strong>/510</div><details class="builder-iv-details"><summary>IVs bearbeiten</summary>${spreadInputs('builder-iv', ivs, 31, 'builder-iv-input')}</details></div>`}
    </div>
    <div class="builder-actions"><span id="builder-save-status"></span>${editable ? `<button class="btn btn-primary" onclick="window.builderSavePokemon('${mon.id}')">Set speichern</button>` : ''}</div>
    <div class="builder-choice-dock" id="builder-choice-dock" hidden></div>
  </section>`;
}

function renderSpeedPanel(pokemon, catalogMap, sheet, formsBySpecies, items = []) {
  const effectivePokemon = pokemon.map(mon => effectiveTeamMon(mon, catalogMap, formsBySpecies, items));
  const order = speedOrder(effectivePokemon, catalogMap, { mode: sheet.team_mode || 'standard' });
  return `<section class="builder-card builder-speed-card"><div class="builder-panel-title"><span>Speed Order</span><strong>${order.filter(item => item.speed != null).length}</strong></div>
    <div class="builder-speed-list">${order.map((entry, index) => `<div class="builder-speed-row"><b>#${index + 1}</b><span>${esc(entry.pokemonName)}</span><strong>${entry.speed ?? '–'}</strong></div>`).join('') || '<div class="builder-empty-inline">Noch keine Pokémon.</div>'}</div>
  </section>`;
}

function defensiveMultiplier(attackType, defenderTypes = []) {
  return defenderTypes.reduce((value, defenderType) => value * (TYPE_CHART[attackType]?.[defenderType] ?? 1), 1);
}

function renderTeamDefensePanel(pokemon, catalogMap, formsBySpecies, items = []) {
  const rows = TYPE_ORDER.map(type => {
    const counts = { immune: 0, resist: 0, neutral: 0, weak: 0 };
    pokemon.forEach(mon => {
      const entry = effectiveTeamEntry(mon, catalogMap, formsBySpecies, items);
      const multiplier = defensiveMultiplier(type, entry?.types || []);
      if (multiplier === 0) counts.immune++;
      else if (multiplier < 1) counts.resist++;
      else if (multiplier > 1) counts.weak++;
      else counts.neutral++;
    });
    const net = counts.resist + counts.immune - counts.weak;
    const tone = net > 0 ? 'good' : net < 0 ? 'bad' : 'even';
    return `<div class="builder-defense-row ${tone}">
      <span class="type-chip type-${esc(type)}">${esc(TYPE_LABELS[type] || type)}</span>
      <b title="Immun">${counts.immune}</b>
      <b title="Resistenz">${counts.resist}</b>
      <b title="Schwaeche">${counts.weak}</b>
      <strong>${net > 0 ? '+' : ''}${net}</strong>
    </div>`;
  }).join('');
  return `<section class="builder-card builder-defense-card"><div class="builder-panel-title"><span>Team Defense</span><strong>${pokemon.length}</strong></div>
    <div class="builder-defense-head"><span>Typ</span><span>0x</span><span>1/2x</span><span>2x</span><span>Net</span></div>
    <div class="builder-defense-list">${pokemon.length ? rows : '<div class="builder-empty-inline">Noch keine Pokemon im Team.</div>'}</div>
  </section>`;
}

function renderTeamCheckPanel(pokemon, sheet, catalog = []) {
  const ruleset = {
    team_size: 6,
    allow_duplicates: false,
    format: sheet.battle_format || 'singles',
    team_mode: sheet.team_mode || 'standard',
    legalPokemonIds: (sheet.team_mode || 'standard') === 'champions'
      ? new Set(catalog.filter(isChampionsLegalEntry).map(mon => mon.pokemon_id))
      : null,
  };
  const result = validateTeam(pokemon, ruleset);
  return `<section class="builder-card builder-check-card"><div class="builder-panel-title"><span>Team Check</span><strong>${result.errors ? 'Fehler' : result.warnings ? 'Hinweise' : 'OK'}</strong></div>
    <div class="builder-check-list">${result.issues.slice(0, 8).map(issue => `<div class="builder-check-item ${issue.level}"><b>${esc(issue.level)}</b><span>${esc(issue.message)}</span></div>`).join('') || '<div class="builder-empty-inline">Alle aktuell prüfbaren Punkte sehen gut aus.</div>'}</div>
  </section>`;
}

export async function renderTeamBuilderPage(root, sheetId) {
  root.innerHTML = '<div class="hub-loading">Team Builder wird geladen…</div>';
  let selectedId = null;
  let showAdd = false;
  let showImport = false;

  try {
    const [sheet, pokemon, catalog, formsResult, references] = await Promise.all([
      getSheet(sheetId),
      listPokemonForSheet(sheetId),
      listPokemonCatalog().catch(() => []),
      listPokemonForms().catch(() => []),
      listReferenceCatalogs().catch(() => ({ moves: [], items: [], abilities: [] })),
    ]);
    if (!sheet) {
      root.innerHTML = pageError('Team nicht gefunden', 'Das Team ist nicht sichtbar oder wurde gelöscht.');
      return;
    }
    const forms = formsResult || [];
    const isOwner = sheet.profile_id === getCurrentUserId() && !sheet.is_locked;
    const editable = isOwner && !sheet.tournament_id;
    const formsBySpecies = new Map();
    forms.forEach(form => {
      if (!formsBySpecies.has(form.species_pokemon_id)) formsBySpecies.set(form.species_pokemon_id, []);
      formsBySpecies.get(form.species_pokemon_id).push(form);
    });
    const catalogMap = makeCatalogMap(catalog, forms);
    const repairImportedMegaRows = async () => {
      if (!editable) return;
      await Promise.all(pokemon.map(async mon => {
        const baseEntry = importedMegaBaseEntry(mon, catalogMap);
        if (!baseEntry) return;
        const inferredForm = megaFormForItem({ ...mon, pokemon_id: baseEntry.pokemon_id }, formsBySpecies, references.items || []);
        const patch = {
          pokemon_id: baseEntry.pokemon_id,
          pokemon_name: baseEntry.pokemon_name,
          form_pokemon_id: inferredForm?.pokemon_id || baseEntry.pokemon_id,
        };
        const saved = await updatePokemonSet(mon.id, patch);
        Object.assign(mon, saved);
      }));
    };
    await repairImportedMegaRows();
    const formIdsForTeam = () => {
      const speciesIds = new Set(pokemon.map(mon => mon.pokemon_id).filter(Boolean));
      const formIds = forms.filter(form => speciesIds.has(form.species_pokemon_id)).map(form => form.pokemon_id);
      const itemFormIds = pokemon.map(mon => megaFormForItem(mon, formsBySpecies, references.items || [])?.pokemon_id).filter(Boolean);
      return [...speciesIds, ...formIds, ...itemFormIds];
    };
    let pokemonAbilities = await listPokemonAbilitiesForPokemon(formIdsForTeam()).catch(() => []);
    let pokemonMoves = await listPokemonMovesForPokemon(formIdsForTeam()).catch(() => []);
    selectedId = pokemon[0]?.id || null;

    const render = () => {
      const selected = pokemon.find(mon => mon.id === selectedId) || null;
      const selectedCatalogEntry = selected ? (catalogMap.get(selected.form_pokemon_id) || catalogMap.get(selected.pokemon_id)) : null;
      const selectedBaseEntry = selected ? catalogMap.get(selected.pokemon_id) : null;
      const filteredReferences = filterReferencesForMode(references, ruleProfileForSheet(sheet));
      const modeLabel = (sheet.team_mode || 'standard') === 'champions' ? 'Champions' : 'Standard';
      root.innerHTML = `<div class="team-builder-page">
        <header class="builder-header">
          <div><span class="eyebrow">Team Builder</span><h1>${esc(sheet.title || 'Team')}</h1><p>${modeLabel} · ${esc(sheet.battle_format || 'singles')} · ${sheet.visibility === 'public' ? 'geteilt' : 'privat'}</p></div>
          <div class="builder-header-actions">
            <button class="btn btn-secondary btn-sm" onclick="location.hash='/teams'">Zurück</button>
            ${editable ? `<select class="form-select builder-format-select" onchange="window.builderSetFormat(this.value)"><option value="singles" ${sheet.battle_format === 'singles' ? 'selected' : ''}>Singles</option><option value="doubles" ${sheet.battle_format === 'doubles' ? 'selected' : ''}>Doubles</option></select>` : ''}
            ${editable ? `<select class="form-select builder-format-select" onchange="window.builderSetRulesProfile(this.value)" ${(sheet.team_mode || 'standard') === 'champions' ? 'disabled' : ''}>${Object.entries(RULE_PROFILE_LABELS).map(([value, label]) => `<option value="${value}" ${ruleProfileForSheet(sheet) === value ? 'selected' : ''}>${label}</option>`).join('')}</select>` : ''}
            ${editable ? `<button class="btn btn-secondary btn-sm" onclick="window.builderToggleShowdownImport()">Showdown importieren</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="window.builderCopyShowdown()">Showdown kopieren</button>
            ${editable ? `<button class="btn btn-primary btn-sm" onclick="window.builderToggleShare()">${sheet.visibility === 'public' ? 'Privat machen' : 'Team teilen'}</button>` : ''}
            ${editable ? `<button class="btn btn-danger btn-sm" onclick="window.builderDeleteTeam()">Team löschen</button>` : ''}
          </div>
        </header>
        <div class="builder-layout">
          ${renderTeamStrip(pokemon, selectedId, editable, catalogMap, sheet, formsBySpecies, filteredReferences.items || [])}
          ${showImport && editable ? renderBuilderShowdownImport(editable) : ''}
          <div class="builder-detail-layout">
            <main>${showAdd && editable ? renderAddPokemonCatalog(catalog, pokemon, sheet.team_mode || 'standard', formsBySpecies) : renderEditor(sheet, selected, selectedCatalogEntry, selectedBaseEntry, formsBySpecies, references, pokemonAbilities, pokemonMoves, editable, catalogMap)}</main>
            <aside class="builder-right-rail">${renderSpeedPanel(pokemon, catalogMap, sheet, formsBySpecies, filteredReferences.items || [])}${renderTeamDefensePanel(pokemon, catalogMap, formsBySpecies, filteredReferences.items || [])}${renderTeamCheckPanel(pokemon, sheet, catalog)}</aside>
          </div>
        </div>
      </div>`;
      const activeForm = selected ? effectiveFormFor(selected, formsBySpecies, filteredReferences.items || []) : null;
      const megaStone = findMegaStone(activeForm, filteredReferences.items || []);
      const itemSelect = document.getElementById('builder-item');
      if (itemSelect && activeForm?.is_mega) {
        if (megaStone) itemSelect.value = megaStone.display_name;
        itemSelect.disabled = true;
        itemSelect.title = megaStone ? `Mega-Form trägt automatisch ${megaStone.display_name}.` : 'Mega-Form erkannt, aber passender Mega-Stein fehlt im Item-Katalog.';
      }
      const abilitySelect = document.getElementById('builder-ability');
      if (abilitySelect && activeForm?.is_mega && !abilitySelect.value) {
        const ability = defaultAbilityFor(selected, pokemonAbilities);
        if (ability) abilitySelect.value = ability.display_name;
      }
      document.querySelectorAll('.builder-picker-select').forEach(select => {
        updatePickerHelp(select);
        updateChoiceCard(select);
      });
      window.refreshBuilderStatPreview?.();
    };

    window.builderSelectPokemon = id => { selectedId = id; showAdd = false; render(); };
    window.builderShowAddPokemon = () => { showAdd = true; showImport = false; render(); };
    window.builderToggleShowdownImport = () => { showImport = !showImport; showAdd = false; render(); };
    window.builderFilterCatalog = () => {
      const search = document.getElementById('builder-add-search')?.value.trim().toLowerCase() || '';
      const existing = new Set(pokemon.map(mon => mon.pokemon_id));
      const filtered = filterCatalogForMode(catalog, sheet.team_mode || 'standard').filter(mon => !existing.has(mon.pokemon_id) && (!search || mon.pokemon_name.toLowerCase().includes(search) || String(mon.dex_number || '').includes(search.replace(/^#/, ''))));
      const select = document.getElementById('builder-add-select');
      if (!select) return;
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = filtered.length ? 'Pokémon auswählen...' : 'Keine Treffer';
      select.append(placeholder);
      filtered.forEach(mon => {
        const option = document.createElement('option');
        option.value = mon.pokemon_id;
        option.textContent = `#${String(mon.dex_number || '').padStart(3, '0')} ${pokemonDisplayName(mon, mon.pokemon_name)}`;
        select.append(option);
      });
      document.getElementById('builder-add-count').textContent = `${filtered.length} gefunden`;
    };
    window.builderAddPokemon = async () => {
      const selectedPokemonId = document.getElementById('builder-add-select')?.value;
      const selected = filterCatalogForMode(catalog, sheet.team_mode || 'standard').find(mon => mon.pokemon_id === selectedPokemonId);
      if (!selected) { toast('Bitte Pokémon auswählen.', 'error'); return; }
      const created = await addPokemonSet(sheet.id, selected, pokemon.length);
      pokemon.push(created);
      pokemonAbilities = await listPokemonAbilitiesForPokemon(formIdsForTeam()).catch(() => pokemonAbilities);
      pokemonMoves = await listPokemonMovesForPokemon(formIdsForTeam()).catch(() => pokemonMoves);
      selectedId = created.id;
      showAdd = false;
      toast(`${selected.pokemon_name} hinzugefügt`, 'success');
      render();
    };
    window.builderFilterCatalog = () => {
      const filters = {
        search: document.getElementById('builder-add-search')?.value || '',
        type: document.getElementById('builder-add-type')?.value || 'all',
        mega: document.getElementById('builder-add-mega')?.value || 'all',
        sort: document.getElementById('builder-add-sort')?.value || 'name',
      };
      const filtered = addCatalogCandidates(catalog, pokemon, sheet.team_mode || 'standard', formsBySpecies, filters);
      const results = document.getElementById('builder-add-results');
      if (results) {
        results.className = addPokemonResultsClass(filtered.length);
        results.innerHTML = addPokemonResultsMarkup(filtered, formsBySpecies);
      }
      const count = document.getElementById('builder-add-count');
      if (count) count.textContent = `${filtered.length} gefunden`;
    };
    window.builderSetAddType = type => {
      const value = type || 'all';
      const input = document.getElementById('builder-add-type');
      if (input) input.value = value;
      document.querySelectorAll('[data-builder-type]').forEach(button => button.classList.toggle('active', button.dataset.builderType === value));
      window.builderFilterCatalog();
    };
    window.builderSetAddMega = mega => {
      const value = mega || 'all';
      const input = document.getElementById('builder-add-mega');
      if (input) input.value = value;
      document.querySelectorAll('[data-builder-mega]').forEach(button => button.classList.toggle('active', button.dataset.builderMega === value));
      window.builderFilterCatalog();
    };
    window.builderAddPokemonFromCatalog = async selectedPokemonId => {
      const selected = filterCatalogForMode(catalog, sheet.team_mode || 'standard').find(mon => mon.pokemon_id === selectedPokemonId);
      if (!selected) { toast('Bitte Pokemon auswaehlen.', 'error'); return; }
      const created = await addPokemonSet(sheet.id, selected, pokemon.length);
      pokemon.push(created);
      pokemonAbilities = await listPokemonAbilitiesForPokemon(formIdsForTeam()).catch(() => pokemonAbilities);
      pokemonMoves = await listPokemonMovesForPokemon(formIdsForTeam()).catch(() => pokemonMoves);
      selectedId = created.id;
      showAdd = false;
      toast(`${selected.pokemon_name} hinzugefuegt`, 'success');
      render();
    };
    window.builderAddPokemon = () => window.builderAddPokemonFromCatalog(document.getElementById('builder-add-select')?.value);
    const applyInferredMegaForms = async importedPokemon => {
      await Promise.all(importedPokemon.map(async mon => {
        const inferredForm = megaFormForItem(mon, formsBySpecies, references.items || []);
        if (!inferredForm || mon.form_pokemon_id === inferredForm.pokemon_id) return;
        const saved = await updatePokemonSet(mon.id, { form_pokemon_id: inferredForm.pokemon_id });
        Object.assign(mon, saved);
      }));
    };
    window.refreshBuilderStatPreview = () => {
      const selected = pokemon.find(mon => mon.id === selectedId);
      if (!selected) return;
      const mode = sheet.team_mode || 'standard';
      const formId = document.getElementById('builder-form')?.value || selected.form_pokemon_id || selected.pokemon_id;
      const draft = { ...selected, form_pokemon_id: formId, nature: document.getElementById('builder-nature')?.value || selected.nature, level: Number(document.getElementById('builder-level')?.value) || selected.level };
      if (mode === 'champions') draft.dvs = Object.fromEntries(STAT_KEYS.map(key => [key, Number(document.getElementById(`builder-dv-${key}`)?.value) || 0]));
      else {
        draft.evs = Object.fromEntries(STAT_KEYS.map(key => [key, Number(document.getElementById(`builder-ev-${key}`)?.value) || 0]));
        draft.ivs = Object.fromEntries(STAT_KEYS.map(key => [key, Number(document.getElementById(`builder-iv-${key}`)?.value) || 31]));
      }
      const total = Object.values(mode === 'champions' ? draft.dvs : draft.evs).reduce((sum, value) => sum + value, 0);
      const totalEl = document.getElementById('builder-spread-total');
      if (totalEl) totalEl.textContent = String(total);
      const statsEntry = statsEntryFor(catalogMap.get(formId), catalogMap.get(selected.pokemon_id));
      const stats = calculatePokemonStats(draft, statsEntry, { mode });
      const preview = document.getElementById('builder-stat-preview');
      if (preview) preview.innerHTML = statsMarkup(stats, 'Stats fehlen im Katalog', draft.nature || '');
    };
    window.builderSavePokemon = async id => {
      const selected = pokemon.find(mon => mon.id === id);
      if (!selected) return;
      const mode = sheet.team_mode || 'standard';
      const patch = {
        form_pokemon_id: document.getElementById('builder-form')?.value || selected.pokemon_id,
        item: document.getElementById('builder-item')?.value.trim() || null,
        ability: document.getElementById('builder-ability')?.value.trim() || null,
        nature: document.getElementById('builder-nature')?.value.trim() || null,
        level: mode === 'champions' ? 50 : Math.max(1, Math.min(100, Number(document.getElementById('builder-level')?.value) || 50)),
        moves: [0, 1, 2, 3].map(index => document.getElementById(`builder-move-${index}`)?.value.trim() || '').filter(Boolean),
      };
      const activeForm = (formsBySpecies.get(selected.pokemon_id) || []).find(form => form.pokemon_id === patch.form_pokemon_id);
      const filteredReferences = filterReferencesForMode(references, ruleProfileForSheet(sheet));
      const megaStone = findMegaStone(activeForm, filteredReferences.items || []);
      if (activeForm?.is_mega) {
        if (megaStone) patch.item = megaStone.display_name;
        const ability = defaultAbilityFor({ ...selected, form_pokemon_id: patch.form_pokemon_id }, pokemonAbilities);
        if (ability) patch.ability = ability.display_name;
      }
      if (mode === 'champions') {
        patch.dvs = Object.fromEntries(STAT_KEYS.map(key => [key, Number(document.getElementById(`builder-dv-${key}`)?.value) || 0]));
        if (!validateChampionsDvs(patch.dvs)) { document.getElementById('builder-save-status').textContent = 'Champions-Werte müssen zwischen 0 und 32 liegen.'; return; }
      } else {
        patch.evs = Object.fromEntries(STAT_KEYS.map(key => [key, Number(document.getElementById(`builder-ev-${key}`)?.value) || 0]));
        patch.ivs = Object.fromEntries(STAT_KEYS.map(key => [key, Number(document.getElementById(`builder-iv-${key}`)?.value) || 31]));
        if (Object.values(patch.evs).reduce((sum, value) => sum + value, 0) > 510) { document.getElementById('builder-save-status').textContent = 'EV-Summe ist über 510.'; return; }
      }
      const saved = await updatePokemonSet(id, patch);
      const index = pokemon.findIndex(mon => mon.id === id);
      if (index >= 0) pokemon[index] = saved;
      toast('Set gespeichert', 'success');
      render();
    };
    window.builderRemovePokemon = async id => {
      if (!confirm('Dieses Pokémon entfernen?')) return;
      await deletePokemonSet(id);
      const index = pokemon.findIndex(mon => mon.id === id);
      if (index >= 0) pokemon.splice(index, 1);
      selectedId = pokemon[0]?.id || null;
      toast('Pokémon entfernt', 'success');
      render();
    };
    window.builderSetFormat = async format => {
      const saved = await updateSheet(sheet.id, { battle_format: format });
      Object.assign(sheet, saved);
      toast('Format aktualisiert', 'success');
      render();
    };
    window.builderSetRulesProfile = async profile => {
      if ((sheet.team_mode || 'standard') === 'champions') return;
      const saved = await updateSheet(sheet.id, { rules_profile: profile || 'open' });
      Object.assign(sheet, saved);
      toast('Auswahlprofil aktualisiert', 'success');
      render();
    };
    window.builderToggleShare = async () => {
      const saved = await updateSheet(sheet.id, { visibility: sheet.visibility === 'public' ? 'private' : 'public' });
      Object.assign(sheet, saved);
      toast('Sichtbarkeit aktualisiert', 'success');
      render();
    };
    window.builderDeleteTeam = async () => {
      if (!editable) return;
      if (!confirm('Team wirklich löschen?')) return;
      await deleteSheet(sheet.id);
      toast('Team gelöscht', 'success');
      location.hash = '/teams';
    };
    window.builderCopyShowdown = async () => {
      await navigator.clipboard.writeText(exportSheetAsShowdown(pokemon));
      toast('Showdown-Text kopiert', 'success');
    };
    window.builderImportShowdown = async () => {
      const textarea = document.getElementById('builder-showdown-import');
      const status = document.getElementById('builder-import-status');
      const text = textarea?.value || '';
      if (!text.trim()) {
        if (status) status.textContent = 'Bitte Showdown-Text einfuegen.';
        return;
      }
      try {
        if (status) status.textContent = 'Import laeuft...';
        const imported = await importShowdownIntoSheet(sheet.id, text);
        pokemon.splice(0, pokemon.length, ...(imported?.length ? imported : await listPokemonForSheet(sheet.id)));
        await applyInferredMegaForms(pokemon);
        pokemonAbilities = await listPokemonAbilitiesForPokemon(formIdsForTeam()).catch(() => pokemonAbilities);
        pokemonMoves = await listPokemonMovesForPokemon(formIdsForTeam()).catch(() => pokemonMoves);
        selectedId = pokemon[0]?.id || null;
        showImport = false;
        showAdd = false;
        toast('Showdown-Team importiert', 'success');
        render();
      } catch (err) {
        if (status) status.textContent = err.message;
        toast('Import fehlgeschlagen: ' + err.message, 'error');
      }
    };
    let activeChoiceFieldId = null;
    let activeChoiceKind = 'item';
    let activeChoiceFilter = 'all';
    const choiceOptionMatches = (option, kind, search, filter) => {
      const group = option.parentElement?.label || '';
      const haystack = [option.value, option.textContent, group, option.dataset.search, option.dataset.alias, option.dataset.info, option.dataset.moveType, option.dataset.moveClass].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      if (!matchesSearch) return false;
      if (!filter || filter === 'all') return true;
      if (kind === 'move') return option.dataset.moveType === filter || option.dataset.moveClass === filter;
      return group === filter;
    };
    const renderChoiceDock = (search = '', cursorPosition = null) => {
      const select = document.getElementById(activeChoiceFieldId);
      const dock = document.getElementById('builder-choice-dock');
      if (!select || !dock) return;
      const kind = activeChoiceKind;
      const options = Array.from(select.options).filter(option => option.value);
      const filterValues = [...new Set(options.flatMap(option => {
        if (kind === 'move') return [option.dataset.moveType, option.dataset.moveClass].filter(Boolean);
        return [option.parentElement?.label].filter(Boolean);
      }))].slice(0, 18);
      const normalizedSearch = String(search || '').trim().toLowerCase();
      const filtered = options.filter(option => choiceOptionMatches(option, kind, normalizedSearch, activeChoiceFilter));
      const title = kind === 'move' ? 'Move auswaehlen' : 'Item auswaehlen';
      const resultClass = filtered.length <= 6 ? 'builder-choice-results compact' : 'builder-choice-results';
      dock.hidden = false;
      dock.innerHTML = `<div class="builder-choice-dock-head">
          <div><span>${esc(title)}</span><strong>${esc(select.selectedOptions?.[0]?.value || 'Keine Auswahl')}</strong></div>
          <button class="btn btn-ghost btn-sm" type="button" onclick="window.closeBuilderChoicePicker()">Schliessen</button>
        </div>
        <div class="builder-choice-tools">
          <input class="form-input" id="builder-choice-search" type="search" placeholder="Suchen..." value="${esc(search)}" oninput="window.builderFilterChoicePicker(this.value, this.selectionStart)">
          <div class="builder-choice-filters">
            <button type="button" class="${activeChoiceFilter === 'all' ? 'active' : ''}" data-choice-filter="all" onclick="window.builderSetChoiceFilter(this.dataset.choiceFilter)">Alle</button>
            ${filterValues.map(value => `<button type="button" class="${activeChoiceFilter === value ? 'active' : ''}" data-choice-filter="${esc(value)}" onclick="window.builderSetChoiceFilter(this.dataset.choiceFilter)">${esc(TYPE_LABELS[value] || value)}</button>`).join('')}
          </div>
        </div>
        <div class="${resultClass}">
          ${filtered.map(option => `<button type="button" class="builder-choice-result ${option.selected ? 'selected' : ''}" data-choice-value="${esc(option.value)}" onclick="window.builderApplyChoice('${esc(activeChoiceFieldId)}', this.dataset.choiceValue)">
            ${choiceSummaryFromOption(option, kind, 'result')}
          </button>`).join('') || '<div class="builder-empty-inline">Keine Treffer.</div>'}
        </div>`;
      const searchInput = document.getElementById('builder-choice-search');
      if (searchInput) {
        searchInput.focus();
        const cursor = Number.isInteger(cursorPosition) ? cursorPosition : searchInput.value.length;
        searchInput.setSelectionRange(cursor, cursor);
      }
    };
    window.openBuilderChoicePicker = (fieldId, kind = 'item') => {
      const select = document.getElementById(fieldId);
      if (!select || select.disabled) return;
      activeChoiceFieldId = fieldId;
      activeChoiceKind = kind;
      activeChoiceFilter = 'all';
      renderChoiceDock();
    };
    window.closeBuilderChoicePicker = () => {
      const dock = document.getElementById('builder-choice-dock');
      if (dock) {
        dock.hidden = true;
        dock.replaceChildren();
      }
      activeChoiceFieldId = null;
    };
    window.builderFilterChoicePicker = (search, cursorPosition = null) => renderChoiceDock(search, cursorPosition);
    window.builderSetChoiceFilter = filter => {
      activeChoiceFilter = filter || 'all';
      renderChoiceDock(document.getElementById('builder-choice-search')?.value || '');
    };
    window.builderApplyChoice = (fieldId, value) => {
      const select = document.getElementById(fieldId);
      if (!select || select.disabled) return;
      select.value = value || '';
      updatePickerHelp(select);
      updateMoveDetail(select);
      updateChoiceCard(select);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      window.closeBuilderChoicePicker();
    };
    window.moveHubPokemon = async (setId, direction) => {
      const index = pokemon.findIndex(mon => mon.id === setId);
      const targetIndex = index + Number(direction);
      if (index < 0 || targetIndex < 0 || targetIndex >= pokemon.length) return;
      [pokemon[index], pokemon[targetIndex]] = [pokemon[targetIndex], pokemon[index]];
      await updatePokemonSetOrder(pokemon);
      render();
    };

    render();
    document.addEventListener('input', event => {
      if (event.target?.classList?.contains('builder-ev-input') || event.target?.classList?.contains('builder-iv-input') || event.target?.classList?.contains('builder-dv-input') || event.target?.id === 'builder-nature' || event.target?.id === 'builder-level') {
        window.refreshBuilderStatPreview?.();
      }
    });
    document.addEventListener('change', event => {
      if (event.target?.classList?.contains('builder-picker-select')) {
        updatePickerHelp(event.target);
        updateMoveDetail(event.target);
        updateChoiceCard(event.target);
      }
      if (event.target?.id === 'builder-form') {
        const selected = pokemon.find(mon => mon.id === selectedId);
        if (selected) {
          selected.form_pokemon_id = event.target.value || selected.pokemon_id;
          const ability = defaultAbilityFor(selected, pokemonAbilities);
          if (ability) selected.ability = ability.display_name;
          const activeForm = selectedFormFor(selected, formsBySpecies);
          const filteredReferences = filterReferencesForMode(references, ruleProfileForSheet(sheet));
          const megaStone = findMegaStone(activeForm, filteredReferences.items || []);
          selected.item = activeForm?.is_mega && megaStone ? megaStone.display_name : selected.item;
          render();
          return;
        }
      }
    });
  } catch (err) {
    root.innerHTML = pageError('Team Builder konnte nicht geladen werden', err.message);
    console.error('[builder] Fehler:', err);
  }
}
