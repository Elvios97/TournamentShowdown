import { getCurrentProfile, logout, setCurrentProfile } from '../auth.js';
import { getAuthSession, listVisibleProfiles, loadProfile } from '../profileService.js';
import { esc, toast } from '../utils.js';

let resolver = null;
let mode = 'startup';

function profileInitial(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
}

function formatLastUsed(value) {
  if (!value) return 'Noch nicht verwendet';
  try {
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function setOverlayOpen(open) {
  document.getElementById('profile-gate')?.classList.toggle('open', open);
}

async function getCurrentSessionId() {
  const session = await getAuthSession().catch(() => null);
  return session?.user?.id || null;
}

async function renderProfileSelector({ message = '' } = {}) {
  const root = document.getElementById('profile-gate');
  if (!root) return;

  const activeProfileId = getCurrentProfile()?.id || null;
  const sessionId = await getCurrentSessionId();
  const dbProfiles = await listVisibleProfiles().catch(() => []);
  const profilesToShow = dbProfiles.map(p => ({
    profileId: p.user_id || p.id,
    displayName: p.display_name || 'Trainer',
    lastUsedAt: p.updated_at || p.created_at,
  }));

  root.innerHTML = `
    <div class="profile-gate-card">
      <div class="profile-gate-header">
        <div>
          <div class="profile-gate-kicker">OTS Drafting</div>
          <h2>Profil auswaehlen</h2>
          <p>Profile aus der Datenbank. Aus Sicherheitsgruenden wechselst du Benutzer ueber Logout und erneuten Login.</p>
        </div>
        ${mode === 'switch' ? `<button class="btn btn-ghost btn-sm" onclick="window.closeProfileSelector()">Schliessen</button>` : ''}
      </div>
      ${message ? `<div class="profile-alert">${esc(message)}</div>` : ''}
      <div class="profile-list">
        ${profilesToShow.length ? profilesToShow.map(profile => {
          const isSession = profile.profileId === sessionId;
          const isActive = profile.profileId === activeProfileId;
          return `
            <div class="profile-option ${isActive ? 'active' : ''}">
              <div class="profile-option-avatar">${esc(profileInitial(profile.displayName))}</div>
              <div class="profile-option-main">
                <div class="profile-option-name">${esc(profile.displayName || 'Trainer')}</div>
                <div class="profile-option-meta">Zuletzt verwendet: ${esc(formatLastUsed(profile.lastUsedAt))}</div>
                ${!isSession ? `<div class="profile-option-warning">Zum Verwenden bitte mit diesem Benutzer einloggen.</div>` : ''}
              </div>
              <div class="profile-option-actions">
                <button class="btn btn-primary btn-sm" ${isSession ? '' : 'disabled'} onclick="window.useKnownProfile('${esc(profile.profileId)}')">Mit diesem Profil fortfahren</button>
              </div>
            </div>`;
        }).join('') : `
          <div class="empty-state" style="padding:20px">
            <div class="empty-title">Noch kein Profil sichtbar.</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:6px">Bitte melde dich mit einem angelegten Benutzer an oder pruefe die Profil-Rechte in Supabase.</div>
          </div>`}
      </div>
      <div class="profile-create-panel">
        <div class="modal-title">Anderen Benutzer verwenden</div>
        <div class="profile-create-row">
          <button class="btn btn-primary" onclick="window.logoutForProfileSwitch()">Logout und neu einloggen</button>
        </div>
        <div class="profile-note">Fremde Profile werden nicht lokal uebernommen. Der Zugriff erfolgt nur ueber Supabase Auth.</div>
      </div>
    </div>`;

  setOverlayOpen(true);
}

async function finishWithProfile(profile) {
  setCurrentProfile(profile);
  setOverlayOpen(false);
  document.dispatchEvent(new CustomEvent('ots:profile-updated'));
  if (resolver) {
    const done = resolver;
    resolver = null;
    done(profile);
  }
}

export async function ensureProfileSelected() {
  const current = getCurrentProfile();
  if (current) {
    return current;
  }

  return new Promise(resolve => {
    resolver = resolve;
    mode = 'startup';
    renderProfileSelector();
  });
}

export function showProfileSwitchModal() {
  mode = 'switch';
  renderProfileSelector();
}

export function closeProfileSelector() {
  if (mode !== 'startup') setOverlayOpen(false);
}

async function useKnownProfile(profileId) {
  try {
    const profile = await loadProfile(profileId);
    toast('Profil geladen', 'success');
    await finishWithProfile(profile);
    if (mode === 'switch') location.reload();
  } catch (err) {
    renderProfileSelector({ message: err.message || 'Profil konnte nicht geladen werden.' });
  }
}


async function logoutForProfileSwitch() {
  await logout();
  location.hash = '/';
  location.reload();
}

export function initProfileSelectorUi() {
  window.useKnownProfile = useKnownProfile;
  window.logoutForProfileSwitch = logoutForProfileSwitch;
  window.showProfileSwitchModal = showProfileSwitchModal;
  window.closeProfileSelector = closeProfileSelector;
}
