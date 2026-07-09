const ACTIVE_PROFILE_KEY = 'ots_active_profile_id_v1';
const KNOWN_PROFILES_KEY = 'ots_known_profiles_v1';

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeProfile(profile) {
  const profileId = profile?.profileId || profile?.id;
  if (!profileId) return null;
  return {
    profileId,
    displayName: profile.displayName || profile.display_name || 'Trainer',
    lastUsedAt: profile.lastUsedAt || new Date().toISOString(),
  };
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || null;
}

export function setActiveProfile(profile) {
  const normalized = normalizeProfile(profile);
  if (!normalized) return null;
  localStorage.setItem(ACTIVE_PROFILE_KEY, normalized.profileId);
  addKnownProfile(normalized);
  updateLastUsed(normalized.profileId);
  return normalized;
}

export function clearActiveProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
}

export function getKnownProfiles() {
  const list = readJson(KNOWN_PROFILES_KEY, []);
  return Array.isArray(list)
    ? list.filter(p => p && p.profileId).sort((a, b) => String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')))
    : [];
}

export function addKnownProfile(profile) {
  const normalized = normalizeProfile(profile);
  if (!normalized) return getKnownProfiles();
  const list = getKnownProfiles();
  const next = [
    { ...normalized, lastUsedAt: normalized.lastUsedAt || new Date().toISOString() },
    ...list.filter(p => p.profileId !== normalized.profileId),
  ];
  writeJson(KNOWN_PROFILES_KEY, next);
  return next;
}

export function removeKnownProfile(profileId) {
  const next = getKnownProfiles().filter(p => p.profileId !== profileId);
  writeJson(KNOWN_PROFILES_KEY, next);
  if (getActiveProfileId() === profileId) clearActiveProfile();
  return next;
}

export function updateLastUsed(profileId) {
  const next = getKnownProfiles().map(p => (
    p.profileId === profileId ? { ...p, lastUsedAt: new Date().toISOString() } : p
  ));
  writeJson(KNOWN_PROFILES_KEY, next);
  return next;
}
