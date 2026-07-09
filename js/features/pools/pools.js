// ─── FEATURE: DRAFT POOLS ────────────────────────────────────────────
import { getCurrentUserId } from '../../auth.js';
import { selectMany, selectOne, insertRow, insertRows, updateRow, deleteRow, deleteMany, rpc } from '../../storage/supabaseRepo.js';
import { rand } from '../../utils.js';
import { toPokemonId } from '../../sprites.js';

export async function listPoolsForTournament(tournamentId) {
  return selectMany('draft_pools', { match: { tournament_id: tournamentId }, order: 'created_at' });
}

export async function listPublicPoolTemplates() {
  return selectMany('draft_pools', { match: { is_template: true, visibility: 'public' }, order: 'name' });
}

export async function getPool(id) {
  return selectOne('draft_pools', { id });
}

export async function listPoolPokemon(poolId) {
  return selectMany('draft_pool_pokemon', { match: { pool_id: poolId }, order: 'pokemon_name' });
}

export async function listPokemonCatalog(generation = null) {
  return selectMany('pokemon_catalog', {
    match: generation ? { generation } : {},
    order: 'dex_number',
  });
}

export async function listPokemonForms() {
  return selectMany('pokemon_form_catalog', {
    order: 'pokemon_name',
  });
}

export async function createPool(tournamentId, form) {
  const userId = getCurrentUserId();
  return insertRow('draft_pools', {
    owner_id: userId,
    tournament_id: tournamentId || null,
    name: form.name || 'Pool',
    description: form.description || '',
    is_template: !!form.is_template,
    visibility: form.visibility || 'private',
  });
}

export async function createTournamentPool(tournamentId, name) {
  return rpc('create_tournament_pool', {
    p_tournament_id: tournamentId,
    p_name: name || null,
  });
}

export async function addCatalogPokemonToPool(poolId, pokemonId) {
  return rpc('add_catalog_pokemon_to_pool', {
    p_pool_id: poolId,
    p_pokemon_id: pokemonId,
  });
}

export async function addGenerationToPool(poolId, generation) {
  return rpc('add_generation_to_pool', {
    p_pool_id: poolId,
    p_generation: generation,
  });
}

export async function updatePoolRankings(poolId, entries) {
  return rpc('update_pool_rankings', {
    p_pool_id: poolId,
    p_entries: entries,
  });
}

export async function resetPoolRankings(poolId, pokemonIds = null) {
  return rpc('reset_pool_rankings', {
    p_pool_id: poolId,
    p_pokemon_ids: pokemonIds?.length ? pokemonIds : null,
  });
}

export function exportRankingJson(pool, pokemonList) {
  return {
    schemaVersion: 1,
    type: 'pool_ranking',
    data: {
      pool_name: pool.name,
      pokemon: pokemonList.map(mon => ({
        pokemon_id: mon.pokemon_id,
        pokemon_name: mon.pokemon_name,
        tier: mon.tier,
        cost: mon.cost,
        is_banned: !!mon.is_banned,
        tags: mon.tags || [],
        notes: mon.notes || '',
      })),
    },
  };
}

export function downloadRankingJson(pool, pokemonList) {
  const data = exportRankingJson(pool, pokemonList);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ranking-${toPokemonId(pool.name || 'pool')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function parseRankingFile(file) {
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  if (!raw || raw.schemaVersion !== 1 || raw.type !== 'pool_ranking' || !raw.data) {
    throw new Error('Keine gültige Ranking-Datei (schemaVersion 1, type pool_ranking).');
  }
  const list = raw.data.pokemon;
  if (!Array.isArray(list) || !list.length) throw new Error('Die Ranking-Datei enthält keine Pokémon.');
  if (list.length > 1000) throw new Error('Maximal 1000 Einträge pro Import.');
  return list.map((entry, index) => {
    const pokemonId = String(entry?.pokemon_id || '').trim().toLowerCase();
    const tier = String(entry?.tier || '').trim().toUpperCase();
    const cost = Number(entry?.cost);
    if (!pokemonId) throw new Error(`Eintrag ${index + 1}: pokemon_id fehlt.`);
    if (!['S', 'A', 'B', 'C', 'D'].includes(tier)) throw new Error(`Eintrag ${index + 1}: ungültiges Tier.`);
    if (!Number.isInteger(cost) || cost < 0 || cost > 100) throw new Error(`Eintrag ${index + 1}: Kosten müssen zwischen 0 und 100 liegen.`);
    return {
      pokemon_id: pokemonId,
      tier,
      cost,
      is_banned: !!entry.is_banned,
      tags: Array.isArray(entry.tags) ? entry.tags.map(String).slice(0, 20) : [],
      notes: String(entry.notes || '').slice(0, 1000),
    };
  });
}

export async function updatePool(id, patch) {
  return updateRow('draft_pools', id, patch);
}

export async function deletePool(id) {
  return deleteRow('draft_pools', id);
}

export async function addPokemonToPool(poolId, mon) {
  return insertRow('draft_pool_pokemon', {
    pool_id: poolId,
    pokemon_id: mon.pokemon_id || toPokemonId(mon.pokemon_name),
    pokemon_name: mon.pokemon_name,
    types: mon.types || [],
    generation: mon.generation || null,
    tier: mon.tier || null,
    cost: mon.cost ?? null,
    tags: mon.tags || [],
    is_banned: !!mon.is_banned,
    notes: mon.notes || '',
  });
}

export async function bulkAddPokemonToPool(poolId, list) {
  return insertRows('draft_pool_pokemon', list.map(mon => ({
    pool_id: poolId,
    pokemon_id: mon.pokemon_id || toPokemonId(mon.pokemon_name),
    pokemon_name: mon.pokemon_name,
    types: mon.types || [],
    generation: mon.generation || null,
    tier: mon.tier || null,
    cost: mon.cost ?? null,
    tags: mon.tags || [],
    is_banned: !!mon.is_banned,
    notes: mon.notes || '',
  })));
}

export async function updatePoolPokemon(id, patch) {
  return updateRow('draft_pool_pokemon', id, patch);
}

export async function removePoolPokemon(id) {
  return deleteRow('draft_pool_pokemon', id);
}

export async function clearPool(poolId) {
  return deleteMany('draft_pool_pokemon', { pool_id: poolId });
}

/** Filtert eine bereits geladene Pool-Liste lokal (Suche/Filter clientseitig, Pools sind klein genug). */
export function filterPool(list, { search = '', type = '', tag = '', includeBanned = false } = {}) {
  const s = search.trim().toLowerCase();
  return list.filter(p => {
    if (!includeBanned && p.is_banned) return false;
    if (s && !p.pokemon_name.toLowerCase().includes(s)) return false;
    if (type && !(p.types || []).includes(type)) return false;
    if (tag && !(p.tags || []).includes(tag)) return false;
    return true;
  });
}

export function randomFromPool(list, filters = {}) {
  const candidates = filterPool(list, { ...filters, includeBanned: false });
  if (!candidates.length) return null;
  return rand(candidates);
}

export function exportPoolJson(pool, pokemonList) {
  return {
    schemaVersion: 1,
    type: 'pool',
    data: {
      name: pool.name,
      description: pool.description,
      pokemon: pokemonList.map(p => ({
        pokemon_id: p.pokemon_id, pokemon_name: p.pokemon_name, types: p.types,
        generation: p.generation, tier: p.tier, cost: p.cost, tags: p.tags,
        is_banned: p.is_banned, notes: p.notes,
      })),
    },
  };
}
