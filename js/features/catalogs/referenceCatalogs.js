import { getSupabase } from '../../supabaseClient.js';
import { selectMany } from '../../storage/supabaseRepo.js?v=20260712a';

export async function listReferenceCatalogs() {
  const [moves, items, abilities] = await Promise.all([
    selectMany('move_catalog', { order: 'display_name' }),
    selectMany('item_catalog', { order: 'display_name' }),
    selectMany('ability_catalog', { order: 'display_name' }),
  ]);
  return { moves, items, abilities };
}

export async function listPokemonAbilities() {
  return selectMany('pokemon_ability_catalog', { order: 'display_name' });
}

export async function listPokemonAbilitiesForPokemon(pokemonIds = []) {
  const ids = [...new Set(pokemonIds.filter(Boolean))];
  if (!ids.length) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pokemon_ability_catalog')
    .select('*')
    .in('pokemon_id', ids)
    .order('display_name')
    .limit(2000);
  if (error) throw error;
  return data || [];
}

export async function listPokemonMoves() {
  return selectMany('pokemon_move_catalog', { order: 'display_name' });
}

export async function listPokemonMovesForPokemon(pokemonIds = []) {
  const ids = [...new Set(pokemonIds.filter(Boolean))];
  if (!ids.length) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pokemon_move_catalog')
    .select('*')
    .in('pokemon_id', ids)
    .order('display_name')
    .limit(5000);
  if (error) throw error;
  return data || [];
}
