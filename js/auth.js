import { getSupabase } from './supabaseClient.js';
const AUTH_EMAIL_DOMAIN = 'pokemon-draft.local';
let currentProfile = null;
let currentUserId = null;
let readyPromise = null;


export function getCurrentProfile() { return currentProfile; }
export function getCurrentUserId() { return currentUserId; }
export function getCurrentUser() { return currentUserId ? { id: currentUserId } : null; }

export function normalizeUsername(username) {
  const clean = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(clean)) {
    throw new Error('Benutzername: 3-32 Zeichen, nur a-z, 0-9, _ und -.');
  }
  return clean;
}

export function usernameToAuthEmail(username) {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}

export function setCurrentProfile(profile) {
  currentProfile = profile || null;
  currentUserId = profile?.id || profile?.user_id || currentUserId || null;
}

/** Initialisiert Auth + Profil. Muss vor allen anderen Supabase-Zugriffen abgewartet werden. */
export function initAuth() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const supabase = getSupabase();
    let { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      currentProfile = null;
      currentUserId = null;
      return null;
    }

    const profile = await loadProfileForUser(session.user);
    setCurrentProfile(profile);
    return profile;
  })();
  return readyPromise;
}

export function resetAuthReadyState() {
  readyPromise = null;
}

async function loadProfileForUser(user) {
  const supabase = getSupabase();
  currentUserId = user.id;

  let { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error && error.code === '42703') {
    // Backward compatibility before the login migration is applied.
    const legacy = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    profile = legacy.data;
    error = legacy.error;
  }

  if (error) throw error;

  if (!profile) {
    const username = user.email?.split('@')[0] || 'trainer-' + user.id.slice(0, 4);
    const displayName = user.user_metadata?.display_name || username;
    const insertPayload = {
      id: user.id,
      user_id: user.id,
      username,
      display_name: displayName,
      global_role: 'user',
    };
    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert(insertPayload)
      .select('*')
      .single();
    if (insertError) throw insertError;
    profile = inserted;
  }

  return profile;
}

export async function loginWithUsernamePassword(username, password) {
  const email = usernameToAuthEmail(username);
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  resetAuthReadyState();
  const profile = await loadProfileForUser(data.user);
  setCurrentProfile(profile);
  return profile;
}

export async function logout() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentProfile = null;
  currentUserId = null;
  readyPromise = null;
}

/** True, wenn der Nutzer noch nie einen eigenen Anzeigenamen gesetzt hat (Trainer-XXXX Default). */
export function needsDisplayName() {
  return !currentProfile || /^Trainer-[a-z0-9]{4}$/i.test(currentProfile.display_name || '');
}

export async function setDisplayName(name) {
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) throw new Error('Name darf nicht leer sein.');
  const supabase = getSupabase();
  let { data, error } = await supabase
    .from('profiles')
    .update({ display_name: clean })
    .eq('user_id', currentUserId)
    .select('*')
    .single();
  if (error && error.code === '42703') {
    const legacy = await supabase
      .from('profiles')
      .update({ display_name: clean })
      .eq('id', currentUserId)
      .select('*')
      .single();
    data = legacy.data;
    error = legacy.error;
  }
  if (error) throw error;
  setCurrentProfile(data);
  return data;
}
