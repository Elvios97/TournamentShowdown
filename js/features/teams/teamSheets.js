// ─── FEATURE: TEAM SHEETS (Open Team Sheets) ────────────────────────
import { getCurrentUserId } from '../../auth.js';
import { selectMany, selectOne, insertRow, updateRow, deleteRow, rpc } from '../../storage/supabaseRepo.js';
import { parseShowdown, exportShowdown } from '../../showdownParser.js';
import { toPokemonId } from '../../sprites.js';
import { normalizeImportedTeam } from './teamImportValidation.js?v=20260705';
import { championsDvsForImport } from './championsImport.js?v=20260710b';

export async function listSheetsForTournament(tournamentId) {
  return selectMany('team_sheets', { match: { tournament_id: tournamentId }, order: 'created_at' });
}

export async function listPersonalSheets() {
  const userId = getCurrentUserId();
  return selectMany('team_sheets', { match: { profile_id: userId, tournament_id: null }, order: 'created_at' });
}

export async function listOwnedSheets() {
  const userId = getCurrentUserId();
  return selectMany('team_sheets', { match: { profile_id: userId }, order: 'created_at' });
}

export async function listPublicSheets() {
  return selectMany('team_sheets', { match: { visibility: 'public' }, order: 'created_at', ascending: false });
}

export async function listPersonalSheetsByMode(teamMode = 'standard') {
  const list = await listPersonalSheets();
  return list.filter(sheet => (sheet.team_mode || 'standard') === teamMode);
}

export async function listPublicSheetsByMode(teamMode = 'standard') {
  const list = await listPublicSheets();
  return list.filter(sheet => (sheet.team_mode || 'standard') === teamMode);
}

export async function getMySheet(tournamentId) {
  const userId = getCurrentUserId();
  const list = await selectMany('team_sheets', { match: { tournament_id: tournamentId, profile_id: userId } });
  return list[0] || null;
}

export async function getSheet(id) {
  return selectOne('team_sheets', { id });
}

export async function listPokemonForSheet(sheetId) {
  return selectMany('pokemon_sets', { match: { team_sheet_id: sheetId }, order: 'sort_order' });
}

export async function createSheet(tournamentId, memberId, title) {
  const userId = getCurrentUserId();
  return insertRow('team_sheets', {
    tournament_id: tournamentId,
    member_id: memberId,
    profile_id: userId,
    title: title || 'Team',
    visibility: 'tournament',
  });
}

export async function createPersonalSheet(title, options = {}) {
  const userId = getCurrentUserId();
  const row = {
    tournament_id: null,
    member_id: null,
    profile_id: userId,
    title: title || 'Team',
    visibility: 'private',
  };
  if (options.team_mode) row.team_mode = options.team_mode;
  if (options.battle_format) row.battle_format = options.battle_format;
  if (options.rules_profile) row.rules_profile = options.rules_profile;
  return insertRow('team_sheets', row);
}

export async function updateSheet(id, patch) {
  return updateRow('team_sheets', id, patch);
}

export async function deleteSheet(id) {
  return deleteRow('team_sheets', id);
}

export async function copyPokemonBetweenSheets(sourceSheetId, targetSheetId) {
  const pokemon = await listPokemonForSheet(sourceSheetId);
  if (!pokemon.length) return [];
  return replacePokemonSets(targetSheetId, pokemon);
}

export async function duplicatePersonalSheet(sourceSheetId) {
  const source = await getSheet(sourceSheetId);
  if (!source || source.profile_id !== getCurrentUserId() || source.tournament_id) {
    throw new Error('Persönliches Team nicht gefunden.');
  }
  const target = await createPersonalSheet(`${source.title || 'Team'} (Kopie)`, {
    team_mode: source.team_mode || 'standard',
    battle_format: source.battle_format || 'singles',
  });
  if (source.ball_variant || source.ruleset_id) await updateSheet(target.id, { ball_variant: source.ball_variant || 'poke', ruleset_id: source.ruleset_id || null });
  await copyPokemonBetweenSheets(source.id, target.id);
  return target;
}

export async function copyPersonalSheetToTournament(sourceSheetId, tournamentId, memberId, existingSheet = null) {
  const source = await getSheet(sourceSheetId);
  if (!source || source.profile_id !== getCurrentUserId() || source.tournament_id) {
    throw new Error('Persönliches Team nicht gefunden.');
  }

  const target = existingSheet || await createSheet(tournamentId, memberId, source.title || 'Team');
  if (existingSheet) await updateSheet(existingSheet.id, { title: source.title || existingSheet.title, ball_variant: source.ball_variant || 'poke' });
  else if (source.ball_variant) await updateSheet(target.id, { ball_variant: source.ball_variant });
  await copyPokemonBetweenSheets(source.id, target.id);
  return target;
}

/** Ersetzt den kompletten Pokémon-Satz eines Sheets durch einen geparsten Showdown-Export. */
function normalizeShowdownPokemonForImport(mon = {}) {
  const rawName = String(mon.name || '').trim();
  const megaMatch = rawName.match(/^Mega\s+(.+)$/i);
  const pokemonName = megaMatch ? megaMatch[1].trim() : rawName;
  const item = String(mon.item || '').trim() || (megaMatch ? `${pokemonName.replace(/\s+/g, '')}ite` : '');
  return { pokemonName, pokemonId: toPokemonId(pokemonName), item };
}

export async function importShowdownIntoSheet(sheetId, showdownText) {
  if (typeof showdownText !== 'string' || showdownText.length > 100_000) {
    throw new Error('Der Showdown-Import ist leer oder größer als 100 KB.');
  }
  const parsed = parseShowdown(showdownText);
  if (!parsed.length) throw new Error('Showdown-Format nicht erkannt.');
  const sheet = await getSheet(sheetId).catch(() => null);
  const isChampions = (sheet?.team_mode || 'standard') === 'champions';
  await replacePokemonSets(sheetId, parsed.map(mon => {
    const normalized = normalizeShowdownPokemonForImport(mon);
    return {
      pokemon_id: normalized.pokemonId, pokemon_name: normalized.pokemonName,
      nickname: mon.nickname, item: normalized.item, ability: mon.ability,
      tera_type: mon.tera, nature: mon.nature, evs: mon.evs, moves: mon.moves,
    };
  }));
  const rows = await listPokemonForSheet(sheetId);
  await Promise.all(rows.map((row, index) => {
    const source = parsed[index];
    if (!source) return null;
    const patch = {};
    if (source.ivs && Object.keys(source.ivs).length) patch.ivs = source.ivs;
    if (isChampions) patch.dvs = championsDvsForImport(source);
    return Object.keys(patch).length ? updatePokemonSet(row.id, patch) : null;
  }).filter(Boolean));
  return listPokemonForSheet(sheetId);
}

export async function replacePokemonSets(sheetId, pokemonList) {
  const normalized = normalizeImportedTeam(pokemonList);
  try {
    return await rpc('replace_team_sheet_pokemon', { p_sheet_id: sheetId, p_sets: normalized });
  } catch (error) {
    const message = String(error?.message || '');
    if (error?.code === 'PGRST202' || message.includes('replace_team_sheet_pokemon')) {
      throw new Error('Die Import-Funktion fehlt in Supabase. Führe zuerst SUPABASE_ATOMIC_TEAM_IMPORT.sql aus.');
    }
    throw error;
  }
}

export function exportSheetAsShowdown(pokemonList) {
  return exportShowdown(pokemonList);
}

export async function updatePokemonSet(id, patch) {
  return updateRow('pokemon_sets', id, patch);
}

export async function addPokemonSet(sheetId, pokemon, sortOrder = 0) {
  if (!sheetId || !pokemon?.pokemon_name) throw new Error('Pokémon-Daten fehlen.');
  return insertRow('pokemon_sets', {
    team_sheet_id: sheetId,
    pokemon_id: pokemon.pokemon_id || toPokemonId(pokemon.pokemon_name),
    pokemon_name: pokemon.pokemon_name,
    form_pokemon_id: pokemon.form_pokemon_id || pokemon.pokemon_id || toPokemonId(pokemon.pokemon_name),
    nickname: null,
    item: null,
    ability: null,
    tera_type: null,
    nature: null,
    level: 50,
    evs: {},
    ivs: {},
    dvs: {},
    moves: [],
    notes: '',
    sort_order: sortOrder,
  });
}

export async function updatePokemonSetOrder(pokemonList) {
  await Promise.all(pokemonList.map((pokemon, index) => updateRow('pokemon_sets', pokemon.id, { sort_order: index })));
}

export async function deletePokemonSet(id) {
  return deleteRow('pokemon_sets', id);
}

export function exportSheetJson(sheet, pokemonList) {
  return {
    schemaVersion: 1,
    type: 'team_sheet',
    data: {
      title: sheet.title,
      visibility: sheet.visibility,
      ball_variant: sheet.ball_variant || 'poke',
      team_mode: sheet.team_mode || 'standard',
      battle_format: sheet.battle_format || 'singles',
      pokemon: pokemonList.map(p => ({
        pokemon_id: p.pokemon_id, pokemon_name: p.pokemon_name, nickname: p.nickname,
        form_pokemon_id: p.form_pokemon_id, level: p.level,
        item: p.item, ability: p.ability, tera_type: p.tera_type, nature: p.nature,
        evs: p.evs, ivs: p.ivs, dvs: p.dvs, moves: p.moves, notes: p.notes,
      })),
    },
  };
}
