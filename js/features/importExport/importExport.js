// ─── FEATURE: IMPORT / EXPORT ────────────────────────────────────────
import { getCurrentUserId } from '../../auth.js';
import { selectMany, selectOne } from '../../storage/supabaseRepo.js';
import { exportRulesetJson, cloneRulesetIntoTournament, createRuleset } from '../rulesets/rulesets.js';
import { exportPoolJson, createPool, bulkAddPokemonToPool } from '../pools/pools.js';
import { exportSheetJson, importShowdownIntoSheet, replacePokemonSets, updateSheet } from '../teams/teamSheets.js?v=20260705b';
import { exportShowdown } from '../../showdownParser.js';
import { assertImportFileSize } from '../teams/teamImportValidation.js?v=20260705';

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function validateEnvelope(data, expectedType, requiredFields = []) {
  if (!data || typeof data !== 'object') throw new Error('Ungültige Datei.');
  if (data.schemaVersion !== 1) throw new Error('Nicht unterstützte schemaVersion. Erwartet wird Version 1.');
  if (data.type !== expectedType) throw new Error(`Falscher Typ: erwartet "${expectedType}", bekommen "${data.type}".`);
  if (!data.data || typeof data.data !== 'object') throw new Error('Feld "data" fehlt.');
  for (const f of requiredFields) {
    if (!(f in data.data)) throw new Error(`Pflichtfeld "${f}" fehlt.`);
  }
  return data.data;
}

// ─── EXPORT ──────────────────────────────────────────────────────────
export async function exportRuleset(ruleset) {
  downloadJson(`ruleset-${ruleset.name}.json`, exportRulesetJson(ruleset));
}

export async function exportPool(pool) {
  const pokemon = await selectMany('draft_pool_pokemon', { match: { pool_id: pool.id } });
  downloadJson(`pool-${pool.name}.json`, exportPoolJson(pool, pokemon));
}

export async function exportDraftConfig({ pool, ruleset, session, players = [] }) {
  if (!pool || !ruleset) throw new Error('Pool und Ruleset werden für den Export benötigt.');
  const pokemon = await selectMany('draft_pool_pokemon', { match: { pool_id: pool.id }, order: 'pokemon_name' });
  const playerNames = new Map(players.map(player => [player.id, player.name]));
  const pickOrder = (session?.pick_order || players.map(player => player.id))
    .map(memberId => playerNames.get(memberId))
    .filter(Boolean);

  downloadJson(`draft-${pool.name}.json`, {
    schemaVersion: 1,
    type: 'draft_config',
    data: {
      pool: exportPoolJson(pool, pokemon).data,
      ruleset: exportRulesetJson(ruleset).data,
      draft: { mode: ruleset.draft_mode || 'snake', pick_order: pickOrder },
    },
  });
}

export async function exportTeamSheet(sheet) {
  const pokemon = await selectMany('pokemon_sets', { match: { team_sheet_id: sheet.id }, order: 'sort_order' });
  downloadJson(`team-${sheet.title}.json`, exportSheetJson(sheet, pokemon));
}

export function exportTeamSheetAsShowdownText(pokemonList) {
  return exportShowdown(pokemonList);
}

export async function exportTournamentBackup(tournament) {
  const [members, rulesets, pools, sheets, matches] = await Promise.all([
    selectMany('tournament_members', { match: { tournament_id: tournament.id } }),
    selectMany('rulesets', { match: { tournament_id: tournament.id } }),
    selectMany('draft_pools', { match: { tournament_id: tournament.id } }),
    selectMany('team_sheets', { match: { tournament_id: tournament.id } }),
    selectMany('matches', { match: { tournament_id: tournament.id } }),
  ]);
  const poolPokemon = {};
  for (const p of pools) poolPokemon[p.id] = await selectMany('draft_pool_pokemon', { match: { pool_id: p.id } });
  const sheetPokemon = {};
  for (const s of sheets) sheetPokemon[s.id] = await selectMany('pokemon_sets', { match: { team_sheet_id: s.id }, order: 'sort_order' });

  downloadJson(`turnier-${tournament.slug}-backup.json`, {
    schemaVersion: 1,
    type: 'tournament_backup',
    data: { tournament, members, rulesets, pools, poolPokemon, sheets, sheetPokemon, matches },
  });
}

// ─── IMPORT ──────────────────────────────────────────────────────────
export async function importRulesetFile(file, tournamentId) {
  const text = await file.text();
  const raw = JSON.parse(text);
  const data = validateEnvelope(raw, 'ruleset', ['name']);
  return createRuleset(tournamentId, data);
}

export async function importPoolFile(file, tournamentId) {
  const text = await file.text();
  const raw = JSON.parse(text);
  const data = validateEnvelope(raw, 'pool', ['name']);
  const pool = await createPool(tournamentId, { name: data.name, description: data.description });
  if (Array.isArray(data.pokemon) && data.pokemon.length) {
    await bulkAddPokemonToPool(pool.id, data.pokemon);
  }
  return pool;
}

function normalizedPlayerName(value) {
  return String(value || '').trim().toLocaleLowerCase('de-DE');
}

function validateDraftConfig(raw) {
  const data = validateEnvelope(raw, 'draft_config', ['pool', 'ruleset', 'draft']);
  if (!data.pool || typeof data.pool !== 'object' || !String(data.pool.name || '').trim()) {
    throw new Error('Der Draft-Pool benötigt einen Namen.');
  }
  if (!Array.isArray(data.pool.pokemon) || !data.pool.pokemon.length) {
    throw new Error('Der Draft-Pool enthält keine Pokémon.');
  }
  const pokemonIds = new Set();
  data.pool.pokemon.forEach((pokemon, index) => {
    const id = String(pokemon?.pokemon_id || '').trim().toLowerCase();
    const name = String(pokemon?.pokemon_name || '').trim();
    if (!id || !name) throw new Error(`Pokémon ${index + 1}: ID oder Name fehlt.`);
    if (pokemonIds.has(id)) throw new Error(`Pokémon ${index + 1}: doppelte ID "${id}".`);
    pokemonIds.add(id);
    if (pokemon.cost != null && (!Number.isFinite(Number(pokemon.cost)) || Number(pokemon.cost) < 0 || Number(pokemon.cost) > 100)) {
      throw new Error(`Pokémon ${index + 1}: Kosten müssen zwischen 0 und 100 liegen.`);
    }
  });
  if (!data.ruleset || typeof data.ruleset !== 'object' || !String(data.ruleset.name || '').trim()) {
    throw new Error('Das Ruleset benötigt einen Namen.');
  }
  const teamSize = Number(data.ruleset.team_size);
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 100) {
    throw new Error('team_size muss eine ganze Zahl zwischen 1 und 100 sein.');
  }
  if (data.ruleset.points_budget != null) {
    const budget = Number(data.ruleset.points_budget);
    if (!Number.isFinite(budget) || budget < 0) throw new Error('points_budget darf nicht negativ sein.');
  }
  if (!Array.isArray(data.draft.pick_order)) throw new Error('draft.pick_order muss eine Liste sein.');
  const orderNames = data.draft.pick_order.map(normalizedPlayerName);
  if (orderNames.some(name => !name)) throw new Error('Die Pick-Reihenfolge enthält einen leeren Spielernamen.');
  if (new Set(orderNames).size !== orderNames.length) throw new Error('Die Pick-Reihenfolge enthält doppelte Spielernamen.');
  return data;
}

export async function importDraftConfigFile(file, tournamentId, targetPlayers = []) {
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  const data = validateDraftConfig(raw);
  if (!targetPlayers.length) throw new Error('Im Zielturnier sind noch keine Spieler vorhanden.');
  const targetByName = new Map();
  for (const player of targetPlayers) {
    const key = normalizedPlayerName(player.name);
    if (!key || targetByName.has(key)) targetByName.set(key, null);
    else targetByName.set(key, player.id);
  }
  const requestedOrder = data.draft.pick_order.map(normalizedPlayerName);
  const mappedOrder = requestedOrder.map(name => targetByName.get(name));
  const canUseImportedOrder = requestedOrder.length === targetPlayers.length && mappedOrder.every(Boolean);

  const ruleset = await createRuleset(tournamentId, {
    ...data.ruleset,
    name: `${data.ruleset.name} (Import)`,
    is_template: false,
    visibility: 'private',
  });
  const pool = await createPool(tournamentId, {
    name: `${data.pool.name} (Import)`,
    description: data.pool.description || '',
  });
  await bulkAddPokemonToPool(pool.id, data.pool.pokemon);

  return {
    pool,
    ruleset,
    pickOrder: canUseImportedOrder ? mappedOrder : targetPlayers.map(player => player.id),
    importedOrderApplied: canUseImportedOrder,
  };
}

export async function importTeamSheetFile(file, sheetId) {
  assertImportFileSize(file);
  let raw;
  try { raw = JSON.parse(await file.text()); }
  catch { throw new Error('Die Datei enthält kein gültiges JSON.'); }
  const data = validateEnvelope(raw, 'team_sheet', ['pokemon']);
  const result = await replacePokemonSets(sheetId, data.pokemon);
  if (data.title) await updateSheet(sheetId, { title: String(data.title).trim().slice(0, 100) || 'Team' });
  return result;
}

/**
 * Import eines Tournament-Backups. Schreibt NUR, wenn der aktuelle Nutzer
 * Host/Owner des Ziel-Turniers ist (sonst Abbruch) -- verhindert, dass
 * fremde Turniere versehentlich überschrieben werden.
 */
export async function importTournamentBackupFile(file, targetTournament, isHost) {
  const text = await file.text();
  const raw = JSON.parse(text);
  const data = validateEnvelope(raw, 'tournament_backup', ['tournament']);
  if (!isHost) {
    throw new Error('Nur der Host darf ein Backup in dieses Turnier importieren.');
  }
  if (targetTournament.id !== data.tournament.id) {
    throw new Error('Dieses Backup gehört zu einem anderen Turnier-Datensatz. Erstelle stattdessen ein neues Turnier und importiere Ruleset/Pool/Sheets einzeln.');
  }
  return data; // Caller entscheidet, was genau übernommen wird (Ruleset/Pool/Sheets einzeln re-importieren).
}
