import { getCurrentProfile, loginWithUsernamePassword, logout, normalizeUsername } from '../auth.js';
import { esc, toast } from '../utils.js';

let loginResolver = null;

function setLoginOpen(open) {
  document.getElementById('login-gate')?.classList.toggle('open', open);
}

function renderLogin({ message = '', loading = false } = {}) {
  const root = document.getElementById('login-gate');
  if (!root) return;
  root.innerHTML = `
    <div class="login-card">
      <div class="profile-gate-kicker">OTS Drafting</div>
      <h1>Anmelden</h1>
      <p>Dein Hub für Pokémon-Drafts, Turniere und geteilte Teams.</p>
      ${message ? `<div class="profile-alert">${esc(message)}</div>` : ''}
      <form onsubmit="event.preventDefault(); window.submitLogin();">
        <div class="form-group">
          <label class="form-label" for="login-username">Benutzername</label>
          <input class="form-input" id="login-username" autocomplete="username" placeholder="z.B. mirco" ${loading ? 'disabled' : ''} />
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Passwort</label>
          <input class="form-input" id="login-password" type="password" autocomplete="current-password" ${loading ? 'disabled' : ''} />
        </div>
        <button class="btn btn-primary" type="submit" style="width:100%" ${loading ? 'disabled' : ''}>
          ${loading ? 'Anmeldung läuft…' : 'Anmelden'}
        </button>
      </form>
      <div class="profile-note">Die Anmeldung wird sicher über Supabase Auth verarbeitet. Dein Passwort wird nicht in dieser App gespeichert.</div>
      <div class="legal-inline">Unofficial fan-made tool. Not affiliated with Nintendo, Game Freak, Creatures Inc., or The Pokémon Company.</div>
    </div>`;
  setLoginOpen(true);
}

export async function ensureLoggedIn() {
  if (getCurrentProfile()) return getCurrentProfile();
  renderLogin();
  return new Promise(resolve => { loginResolver = resolve; });
}

async function submitLogin() {
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const username = usernameInput?.value || '';
  const password = passwordInput?.value || '';
  try {
    normalizeUsername(username);
    if (!password) throw new Error('Passwort darf nicht leer sein.');
    renderLogin({ loading: true });
    const profile = await loginWithUsernamePassword(username, password);
    setLoginOpen(false);
    toast('Eingeloggt', 'success');
    if (loginResolver) {
      const done = loginResolver;
      loginResolver = null;
      done(profile);
    }
    document.dispatchEvent(new CustomEvent('ots:profile-updated'));
  } catch (err) {
    renderLogin({ message: err.message || 'Login fehlgeschlagen.' });
  }
}

async function submitLogout() {
  try {
    await logout();
    location.hash = '/';
    location.reload();
  } catch (err) {
    toast('Logout fehlgeschlagen: ' + err.message, 'error');
  }
}

export function initLoginUi() {
  window.submitLogin = submitLogin;
  window.submitLogout = submitLogout;
}
