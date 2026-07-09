// ─── GENERISCHE SUPABASE-REPOSITORY-HELFER ─────────────────────────
// Dünne Wrapper um supabase-js, damit Feature-Module nicht überall
// Error-Handling duplizieren. Wirft bei Fehlern (Caller fängt + toast()).

import { getSupabase } from '../supabaseClient.js';

export async function selectOne(table, match) {
  const supabase = getSupabase();
  let q = supabase.from(table).select('*');
  Object.entries(match).forEach(([k, v]) => { q = v === null ? q.is(k, null) : q.eq(k, v); });
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

export async function selectMany(table, { match = {}, order = null, ascending = true } = {}) {
  const supabase = getSupabase();
  let q = supabase.from(table).select('*');
  Object.entries(match).forEach(([k, v]) => { q = v === null ? q.is(k, null) : q.eq(k, v); });
  if (order) q = q.order(order, { ascending });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insertRow(table, row) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function insertRows(table, rows) {
  if (!rows.length) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).insert(rows).select('*');
  if (error) throw error;
  return data || [];
}

export async function updateRow(table, id, patch) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function deleteMany(table, match) {
  const supabase = getSupabase();
  let q = supabase.from(table).delete();
  Object.entries(match).forEach(([k, v]) => { q = v === null ? q.is(k, null) : q.eq(k, v); });
  const { error } = await q;
  if (error) throw error;
  return true;
}

export async function rpc(fnName, args) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(fnName, args);
  if (error) throw error;
  return data;
}
