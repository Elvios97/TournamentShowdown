import { getSupabase } from './supabaseClient.js';

export async function getAuthSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function loadProfile(profileId = null) {
  const session = await getAuthSession();
  if (!session) throw new Error('Keine aktive Supabase-Session.');
  if (profileId && profileId !== session.user.id) {
    throw new Error('Dieses Profil gehoert nicht zur aktuellen Browser-Session.');
  }

  const supabase = getSupabase();
  const id = profileId || session.user.id;
  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', id)
    .maybeSingle();
  if (error && error.code === '42703') {
    const legacy = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    data = legacy.data;
    error = legacy.error;
  }
  if (error) throw error;
  if (!data) {
    throw new Error('Profil existiert nicht mehr oder du hast keinen Zugriff.');
  }
  return data;
}

export async function loadMyProfiles() {
  const session = await getAuthSession();
  if (!session) return [];
  return [await loadProfile(session.user.id)];
}

export async function listVisibleProfiles() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, display_name, updated_at, created_at')
    .order('display_name', { ascending: true });
  if (error) throw error;
  return data || [];
}
