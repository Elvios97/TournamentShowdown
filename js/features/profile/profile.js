// ─── FEATURE: PROFIL / ANZEIGENAME ──────────────────────────────────
import { getCurrentProfile, needsDisplayName, setDisplayName } from '../../auth.js';
import { openModal, closeModal, toast } from '../../utils.js';
import { showProfileSwitchModal } from '../../ui/profileSelector.js';

export function renderHeaderProfile() {
  const el = document.getElementById('header-profile-name');
  const avatar = document.getElementById('header-profile-avatar');
  const profile = getCurrentProfile();
  if (el) el.textContent = profile ? profile.display_name : '…';
  if (avatar) avatar.textContent = (profile?.display_name || 'OT').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

export function maybePromptDisplayName() {
  if (needsDisplayName()) openDisplayNameModal();
}

export function openDisplayNameModal() {
  const input = document.getElementById('dn-name');
  const profile = getCurrentProfile();
  if (input) input.value = (profile && !/^Trainer-[a-z0-9]{4}$/i.test(profile.display_name)) ? profile.display_name : '';
  openModal('display-name');
}

export async function submitDisplayName() {
  const input = document.getElementById('dn-name');
  try {
    await setDisplayName(input.value);
    closeModal('display-name');
    renderHeaderProfile();
    toast('Name gespeichert ✓', 'success');
    document.dispatchEvent(new CustomEvent('ots:profile-updated'));
  } catch (err) {
    toast('Fehler: ' + err.message, 'error');
  }
}

export function initProfileFeature() {
  window.openDisplayNameModal = openDisplayNameModal;
  window.submitDisplayName = submitDisplayName;
  window.showProfileSwitchModal = showProfileSwitchModal;
  renderHeaderProfile();
}
