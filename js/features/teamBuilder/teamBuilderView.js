import { getCurrentUserId } from '../../auth.js';
import { esc, toast } from '../../utils.js';
import { spriteAttrs } from '../../sprites.js?v=20260709s';
import { listPokemonCatalog, listPokemonForms } from '../pools/pools.js';
import { listPokemonAbilities, listPokemonMovesForPokemon, listReferenceCatalogs } from '../catalogs/referenceCatalogs.js';
import {
  getSheet, listPokemonForSheet, updateSheet, addPokemonSet, updatePokemonSet,
  deletePokemonSet, updatePokemonSetOrder, exportSheetAsShowdown,
} from '../teams/teamSheets.js?v=20260708a';
import { validateTeam } from '../teams/teamValidation.js?v=20260705e';
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
};
const NON_BATTLE_ITEM_PATTERN = /(tm|hm|tr|technical|machine|mail|letter|mulch|fossil|apricorn|shard|repel|escape|rope|rod|bike|bicycle|ticket|pass|key|card|parcel|souvenir|photo|flute|doll|honey|nectar|exp\.?\s*share|exp-share|experience|candy|rare-candy|incense)/i;
const BATTLE_ITEM_CATEGORY_PATTERN = /(held|battle|berry|berries|mega|jewel|plate|memory|drive|z-crystal|choice|type-enhancement|species-specific|training)/i;
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
    options.push(`<option value="${esc(value)}" ${value === current ? 'selected' : ''}${pickerOptionAttrs(entry)}>${esc(labeler(entry))}</option>`);
  });
  if (current && !entries.some(entry => (entry[valueKey] || entry.display_name) === current)) {
    options.push(`<option value="${esc(current)}" selected data-missing="true">${esc(current)} · nicht im Profil</option>`);
  }
  return options.join('');
}

function groupItemOptions(items = [], current = '') {
  const groups = new Map();
  items.forEach(item => {
    const category = item.category || 'sonstige';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  const body = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'de')).map(([category, entries]) => (
    `<optgroup label="${esc(category)}">${entries.map(item => `<option value="${esc(item.display_name)}" ${item.display_name === current ? 'selected' : ''}${pickerOptionAttrs(item)}>${esc(item.display_name)}</option>`).join('')}</optgroup>`
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
  return filtered.length ? filtered : items.filter(item => !NON_BATTLE_ITEM_PATTERN.test([item.id, item.display_name, item.german_name, item.category].filter(Boolean).join(' ')));
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

function pokemonDisplayName(entry = null, fallback = '') {
  const en = entry?.pokemon_name || fallback || '';
  const de = entry?.german_name || '';
  return de && de !== en ? `${de} (${en})` : en;
}

function makeCatalogMap(catalog, forms) {
  const map = new Map();
  catalog.forEach(mon => map.set(mon.pokemon_id, mon));
  forms.forEach(form => map.set(form.pokemon_id, form));
  return map;
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

function statsMarkup(stats, missingText = 'Stats fehlen im Katalog') {
  if (!stats) return `<div class="builder-stats-missing">${esc(missingText)}</div>`;
  return `<div class="builder-stat-grid">${STAT_KEYS.map(key => `<div class="builder-stat"><span>${STAT_LABELS[key]}</span><strong>${stats[key]}</strong></div>`).join('')}</div>`;
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
  const stats = calculatePokemonStats(mon, entry, { mode: sheet.team_mode || 'standard' });
  if (!stats) return '';
  return `<div class="builder-slot-bars">${STAT_KEYS.map(key => {
    const width = Math.max(8, Math.min(100, Math.round((stats[key] / 220) * 100)));
    return `<span><b>${STAT_LABELS[key]}</b><i style="width:${width}%"></i><em>${stats[key]}</em></span>`;
  }).join('')}</div>`;
}

function renderTeamStrip(pokemon, selectedId, editable, catalogMap, sheet) {
  const slots = [];
  for (let index = 0; index < 6; index++) {
    const mon = pokemon[index];
    if (!mon) {
      slots.push(`<button class="builder-slot empty" ${editable ? 'onclick="window.builderShowAddPokemon()"' : 'disabled'}>
        <span class="builder-slot-index">${index + 1}</span><strong>+</strong><small>Pokemon hinzufuegen</small>
      </button>`);
      continue;
    }
    const entry = catalogMap.get(mon.form_pokemon_id) || catalogMap.get(mon.pokemon_id);
    const spriteName = entry?.pokemon_name || mon.pokemon_name;
    const displayName = pokemonDisplayName(entry, mon.pokemon_name);
    slots.push(`<button class="builder-slot ${mon.id === selectedId ? 'active' : ''}" onclick="window.builderSelectPokemon('${mon.id}')">
      <span class="builder-slot-index">${index + 1}</span>
      <img ${spriteAttrs(spriteName)} alt="${esc(displayName)}">
      <span class="builder-slot-copy"><strong>${esc(displayName)}</strong>${typeChips(entry)}<small>${esc(mon.item || 'Kein Item')}${mon.ability ? ` · ${esc(mon.ability)}` : ''}</small></span>
      ${miniStatBars(mon, entry, sheet)}
    </button>`);
  }
  return `<section class="builder-team-strip"><div class="builder-panel-title"><span>Team</span><strong>${pokemon.length}/6</strong></div><div class="builder-slots">${slots.join('')}</div></section>`;
}

function filterCatalogForMode(catalog, mode) {
  if (mode !== 'champions') return catalog;
  return catalog.filter(mon => mon.is_champions_legal !== false);
}

function filterReferencesForMode(references, mode) {
  const items = combatItems(references.items || []);
  if (mode === 'champions') {
    const championsItems = items.filter(item => item.is_champions_legal === true);
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

function moveOptionsFor(mon, pokemonMoves, moveCatalog, profile) {
  const formId = mon.form_pokemon_id || mon.pokemon_id;
  const direct = pokemonMoves.filter(entry => entry.pokemon_id === formId);
  const species = pokemonMoves.filter(entry => entry.pokemon_id === mon.pokemon_id);
  const sourceMoves = formId !== mon.pokemon_id ? [...species, ...direct] : (direct.length ? direct : species);
  const scoped = filterMovesForProfile(sourceMoves, profile);
  const metaById = new Map();
  moveCatalog.forEach(move => {
    if (move.id) metaById.set(move.id, move);
    if (move.display_name) metaById.set(move.display_name, move);
  });
  const base = scoped.length
    ? scoped.map(move => ({ ...(metaById.get(move.move_id) || metaById.get(move.display_name) || {}), ...move }))
    : moveCatalog;
  const deduped = new Map();
  base.forEach(move => {
    const key = move.display_name || move.move_id || move.id;
    if (key && !deduped.has(key)) deduped.set(key, move);
  });
  return [...deduped.values()].sort((a, b) => String(a.display_name).localeCompare(String(b.display_name), 'de'));
}

function moveOptionLabel(move) {
  const parts = [move.display_name];
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

function pickerOptionAttrs(entry) {
  const attrs = [pickerInfoAttr(entry)];
  if (entry?.type) attrs.push(` data-move-type="${esc(entry.type)}"`);
  if (entry?.damage_class) attrs.push(` data-move-class="${esc(entry.damage_class)}"`);
  if (entry?.power != null) attrs.push(` data-move-power="${esc(entry.power)}"`);
  if (entry?.accuracy != null) attrs.push(` data-move-accuracy="${esc(entry.accuracy)}"`);
  if (entry?.pp != null) attrs.push(` data-move-pp="${esc(entry.pp)}"`);
  return attrs.filter(Boolean).join('');
}

function selectedInfo(entries, value, id, fallback = '') {
  const entry = value ? entries.find(item => item.display_name === value || item.id === value || item.move_id === value) : null;
  const text = pickerInfoText(entry, fallback);
  return `<small class="builder-picker-help" id="${id}">${esc(text)}</small>`;
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
  const entry = value ? entries.find(item => item.display_name === value || item.id === value || item.move_id === value) : null;
  const selected = entry
    ? {
      value: entry.display_name || entry.move_id || entry.id,
      dataset: {
        moveType: entry.type || '',
        moveClass: entry.damage_class || '',
        movePower: entry.power ?? '',
        moveAccuracy: entry.accuracy ?? '',
        movePp: entry.pp ?? '',
        info: pickerInfoText(entry),
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

function renderAddPokemon(catalog, pokemon, mode) {
  const existing = new Set(pokemon.map(mon => mon.pokemon_id));
  const available = filterCatalogForMode(catalog, mode).filter(mon => !existing.has(mon.pokemon_id));
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

function renderEditor(sheet, mon, catalogEntry, baseCatalogEntry, formsBySpecies, references, pokemonAbilities, pokemonMoves, editable) {
  if (!mon) return '<section class="builder-card builder-empty"><strong>Kein Pokémon ausgewählt.</strong><span>Wähle links einen Slot aus oder füge ein Pokémon hinzu.</span></section>';
  const mode = sheet.team_mode || 'standard';
  const isChampions = mode === 'champions';
  const profile = ruleProfileForSheet(sheet);
  const moves = [...(mon.moves || [])];
  while (moves.length < 4) moves.push('');
  const stats = calculatePokemonStats(mon, catalogEntry, { mode });
  const filteredReferences = filterReferencesForMode(references, profile);
  const selectedForm = selectedFormFor(mon, formsBySpecies);
  const displayEntry = catalogEntry || selectedForm;
  const spriteName = selectedForm?.pokemon_name || mon.pokemon_name;
  const displayName = pokemonDisplayName(displayEntry, mon.pokemon_name);
  const megaStone = findMegaStone(selectedForm, filteredReferences.items || []);
  const abilityOptions = abilityOptionsFor(mon, pokemonAbilities, references.abilities || []);
  const moveOptions = moveOptionsFor(mon, pokemonMoves, references.moves || [], profile);
  const evs = normalizeStatSpread(mon.evs, 252, 0);
  const ivs = normalizeStatSpread(mon.ivs, 31, 31);
  const dvs = normalizeStatSpread(mon.dvs, 32, 0);
  return `<section class="builder-card builder-editor-card">
    <div class="builder-editor-head">
      <div class="builder-editor-identity"><img ${spriteAttrs(spriteName)} alt="${esc(displayName)}"><div><span>${isChampions ? 'Champions-Set' : 'Standard-Set'}</span><h2>${esc(displayName)}</h2>${spriteName !== mon.pokemon_name ? `<small>${esc(mon.pokemon_name)}</small>` : ''}${typeChips(displayEntry)}</div></div>
      ${editable ? `<button class="btn btn-danger btn-sm" onclick="window.builderRemovePokemon('${mon.id}')">Entfernen</button>` : ''}
    </div>
    <div class="builder-editor-grid">
      <div class="builder-editor-main">
        <div class="builder-fields">
          <label class="builder-field"><span>Spitzname</span><input class="form-input" id="builder-nickname" value="${esc(mon.nickname || '')}" ${editable ? '' : 'disabled'}></label>
          <label class="builder-field"><span>Item</span><select class="form-select builder-picker-select" id="builder-item" data-picker-help="builder-item-help" ${editable ? '' : 'disabled'}>${groupItemOptions(filteredReferences.items || [], mon.item || '')}</select>${selectedInfo(filteredReferences.items || [], mon.item, 'builder-item-help')}</label>
          <label class="builder-field"><span>Fähigkeit</span><select class="form-select builder-picker-select" id="builder-ability" data-picker-help="builder-ability-help" ${editable ? '' : 'disabled'}>${selectOptions(abilityOptions, mon.ability || '', ability => `${ability.display_name}${ability.is_hidden ? ' · Hidden' : ''}`)}</select>${selectedInfo(abilityOptions, mon.ability, 'builder-ability-help')}</label>
          <label class="builder-field"><span>Wesen</span><select class="form-select" id="builder-nature" ${editable ? '' : 'disabled'}>${natureOptions(mon.nature || '')}</select></label>
          ${formOptionsDisplayFor(mon, formsBySpecies, baseCatalogEntry || catalogEntry, mode)}
          <label class="builder-field"><span>Level</span><input class="form-input" id="builder-level" type="number" min="1" max="100" value="${isChampions ? 50 : Number(mon.level) || 50}" ${isChampions || !editable ? 'disabled' : ''}></label>
        </div>
        <div class="builder-moves">
          <h3>Moves</h3>
          <div class="builder-move-grid">${moves.slice(0, 4).map((move, index) => `<label class="builder-move-field"><span>Move ${index + 1}</span><select class="form-select builder-picker-select" id="builder-move-${index}" data-move-detail="builder-move-${index}-detail" ${editable ? '' : 'disabled'}>${selectOptions(moveOptions, move, moveOptionLabel)}</select>${selectedMoveDetail(moveOptions, move, `builder-move-${index}-detail`)}</label>`).join('')}</div>
          <p class="builder-picker-note">${esc(RULE_PROFILE_LABELS[profile] || profile)} · ${moveOptions.length} Moves verfügbar${profile === 'champions' ? ' · Champions-Liste kann später per Override nachgeschärft werden' : ''}</p>
        </div>
      </div>
      <aside class="builder-live-stats">
        <div class="builder-panel-title"><span>Live Stats</span><strong>Lv. ${isChampions ? 50 : Number(mon.level) || 50}</strong></div>
        <div id="builder-stat-preview">${statsMarkup(stats)}</div>
      </aside>
    </div>
    <div class="builder-distribution">
      ${isChampions
        ? `<div><h3>Champions-Verteilung</h3><p>0 bis 32 pro Stat. 32 entspricht ungefähr 252 EV.</p>${spreadInputs('builder-dv', dvs, 32, 'builder-dv-input')}<div class="builder-spread-total">Verteilt: <strong id="builder-spread-total">0</strong></div></div>`
        : `<div><h3>EV-Verteilung</h3><p>0 bis 252 pro Stat, maximal 510 insgesamt.</p>${spreadInputs('builder-ev', evs, 252, 'builder-ev-input')}<div class="builder-spread-total">EVs: <strong id="builder-spread-total">0</strong>/510</div><details class="builder-iv-details"><summary>IVs bearbeiten</summary>${spreadInputs('builder-iv', ivs, 31, 'builder-iv-input')}</details></div>`}
    </div>
    <div class="builder-actions"><span id="builder-save-status"></span>${editable ? `<button class="btn btn-primary" onclick="window.builderSavePokemon('${mon.id}')">Set speichern</button>` : ''}</div>
  </section>`;
}

function renderSpeedPanel(pokemon, catalogMap, sheet) {
  const order = speedOrder(pokemon, catalogMap, { mode: sheet.team_mode || 'standard' });
  return `<section class="builder-card builder-speed-card"><div class="builder-panel-title"><span>Speed Order</span><strong>${order.filter(item => item.speed != null).length}</strong></div>
    <div class="builder-speed-list">${order.map((entry, index) => `<div class="builder-speed-row"><b>#${index + 1}</b><span>${esc(entry.pokemonName)}</span><strong>${entry.speed ?? '–'}</strong></div>`).join('') || '<div class="builder-empty-inline">Noch keine Pokémon.</div>'}</div>
  </section>`;
}

function defensiveMultiplier(attackType, defenderTypes = []) {
  return defenderTypes.reduce((value, defenderType) => value * (TYPE_CHART[attackType]?.[defenderType] ?? 1), 1);
}

function renderTeamDefensePanel(pokemon, catalogMap) {
  const rows = TYPE_ORDER.map(type => {
    const counts = { immune: 0, resist: 0, neutral: 0, weak: 0 };
    pokemon.forEach(mon => {
      const entry = catalogMap.get(mon.form_pokemon_id) || catalogMap.get(mon.pokemon_id);
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

function renderTeamCheckPanel(pokemon, sheet) {
  const ruleset = { team_size: 6, allow_duplicates: false, format: sheet.battle_format || 'singles', team_mode: sheet.team_mode || 'standard' };
  const result = validateTeam(pokemon, ruleset);
  return `<section class="builder-card builder-check-card"><div class="builder-panel-title"><span>Team Check</span><strong>${result.errors ? 'Fehler' : result.warnings ? 'Hinweise' : 'OK'}</strong></div>
    <div class="builder-check-list">${result.issues.slice(0, 8).map(issue => `<div class="builder-check-item ${issue.level}"><b>${esc(issue.level)}</b><span>${esc(issue.message)}</span></div>`).join('') || '<div class="builder-empty-inline">Alle aktuell prüfbaren Punkte sehen gut aus.</div>'}</div>
  </section>`;
}

export async function renderTeamBuilderPage(root, sheetId) {
  root.innerHTML = '<div class="hub-loading">Team Builder wird geladen…</div>';
  let selectedId = null;
  let showAdd = false;

  try {
    const [sheet, pokemon, catalog, formsResult, references, pokemonAbilities] = await Promise.all([
      getSheet(sheetId),
      listPokemonForSheet(sheetId),
      listPokemonCatalog().catch(() => []),
      listPokemonForms().catch(() => []),
      listReferenceCatalogs().catch(() => ({ moves: [], items: [], abilities: [] })),
      listPokemonAbilities().catch(() => []),
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
    const moveIdsForTeam = () => {
      const speciesIds = new Set(pokemon.map(mon => mon.pokemon_id).filter(Boolean));
      const formIds = forms.filter(form => speciesIds.has(form.species_pokemon_id)).map(form => form.pokemon_id);
      return [...speciesIds, ...formIds];
    };
    let pokemonMoves = await listPokemonMovesForPokemon(moveIdsForTeam()).catch(() => []);
    const catalogMap = makeCatalogMap(catalog, forms);
    selectedId = pokemon[0]?.id || null;

    const render = () => {
      const selected = pokemon.find(mon => mon.id === selectedId) || null;
      const selectedCatalogEntry = selected ? (catalogMap.get(selected.form_pokemon_id) || catalogMap.get(selected.pokemon_id)) : null;
      const selectedBaseEntry = selected ? catalogMap.get(selected.pokemon_id) : null;
      const modeLabel = (sheet.team_mode || 'standard') === 'champions' ? 'Champions' : 'Standard';
      root.innerHTML = `<div class="team-builder-page">
        <header class="builder-header">
          <div><span class="eyebrow">Team Builder</span><h1>${esc(sheet.title || 'Team')}</h1><p>${modeLabel} · ${esc(sheet.battle_format || 'singles')} · ${sheet.visibility === 'public' ? 'geteilt' : 'privat'}</p></div>
          <div class="builder-header-actions">
            <button class="btn btn-secondary btn-sm" onclick="location.hash='/teams'">Zurück</button>
            ${editable ? `<select class="form-select builder-format-select" onchange="window.builderSetFormat(this.value)"><option value="singles" ${sheet.battle_format === 'singles' ? 'selected' : ''}>Singles</option><option value="doubles" ${sheet.battle_format === 'doubles' ? 'selected' : ''}>Doubles</option></select>` : ''}
            ${editable ? `<select class="form-select builder-format-select" onchange="window.builderSetRulesProfile(this.value)" ${(sheet.team_mode || 'standard') === 'champions' ? 'disabled' : ''}>${Object.entries(RULE_PROFILE_LABELS).map(([value, label]) => `<option value="${value}" ${ruleProfileForSheet(sheet) === value ? 'selected' : ''}>${label}</option>`).join('')}</select>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="window.builderCopyShowdown()">Showdown kopieren</button>
            ${editable ? `<button class="btn btn-primary btn-sm" onclick="window.builderToggleShare()">${sheet.visibility === 'public' ? 'Privat machen' : 'Team teilen'}</button>` : ''}
          </div>
        </header>
        <div class="builder-layout">
          ${renderTeamStrip(pokemon, selectedId, editable, catalogMap, sheet)}
          <div class="builder-detail-layout">
            <main>${showAdd && editable ? renderAddPokemon(catalog, pokemon, sheet.team_mode || 'standard') : renderEditor(sheet, selected, selectedCatalogEntry, selectedBaseEntry, formsBySpecies, references, pokemonAbilities, pokemonMoves, editable)}</main>
            <aside class="builder-right-rail">${renderSpeedPanel(pokemon, catalogMap, sheet)}${renderTeamDefensePanel(pokemon, catalogMap)}${renderTeamCheckPanel(pokemon, sheet)}</aside>
          </div>
        </div>
      </div>`;
      const activeForm = selected ? selectedFormFor(selected, formsBySpecies) : null;
      const filteredReferences = filterReferencesForMode(references, ruleProfileForSheet(sheet));
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
      document.querySelectorAll('.builder-picker-select').forEach(select => updatePickerHelp(select));
      window.refreshBuilderStatPreview?.();
    };

    window.builderSelectPokemon = id => { selectedId = id; showAdd = false; render(); };
    window.builderShowAddPokemon = () => { showAdd = true; render(); };
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
      pokemonMoves = await listPokemonMovesForPokemon(moveIdsForTeam()).catch(() => pokemonMoves);
      selectedId = created.id;
      showAdd = false;
      toast(`${selected.pokemon_name} hinzugefügt`, 'success');
      render();
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
      const stats = calculatePokemonStats(draft, catalogMap.get(formId) || catalogMap.get(selected.pokemon_id), { mode });
      const preview = document.getElementById('builder-stat-preview');
      if (preview) preview.innerHTML = statsMarkup(stats);
    };
    window.builderSavePokemon = async id => {
      const selected = pokemon.find(mon => mon.id === id);
      if (!selected) return;
      const mode = sheet.team_mode || 'standard';
      const patch = {
        form_pokemon_id: document.getElementById('builder-form')?.value || selected.pokemon_id,
        nickname: document.getElementById('builder-nickname')?.value.trim() || null,
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
    window.builderCopyShowdown = async () => {
      await navigator.clipboard.writeText(exportSheetAsShowdown(pokemon));
      toast('Showdown-Text kopiert', 'success');
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
