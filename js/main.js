// ─── MAIN BOOTSTRAP ──────────────────────────────────────────────────
import { initAuth } from './auth.js';
import { navigate, onRoute, onNotFound, startRouter } from './router.js';
import { initModalBackdrops, toast } from './utils.js';
import { initProfileFeature, maybePromptDisplayName } from './features/profile/profile.js';
import { initProfileSelectorUi } from './ui/profileSelector.js';
import { ensureLoggedIn, initLoginUi } from './ui/login.js?v=20260706a';
import { initDashboardFeature, renderDashboard } from './features/dashboard/dashboard.js?v=20260709r';
import { renderTournamentRoute, hideTournamentContextBar } from './features/tournaments/tournamentView.js?v=20260705b';
import { listMyTournaments } from './features/tournaments/tournaments.js';
import { renderTournamentsPage, renderTeamsPage, renderTemplatesPage, renderChampionsPage } from './features/hub/hubViews.js?v=20260706b';
import { renderPublicTeamPage } from './features/publicTeams/publicTeamView.js?v=20260706a';
import { renderTeamBuilderPage } from './features/teamBuilder/teamBuilderView.js?v=20260709u';

const NAV_LABELS = {
  dashboard: 'Dashboard', tournaments: 'Turniere', teams: 'Teams', draft: 'Draft',
  pool: 'Pool', matches: 'Matches', champions: 'Champions', templates: 'Vorlagen', settings: 'Einstellungen',
  builder: 'Team Builder', overview: 'Übersicht', rules: 'Regeln', members: 'Teilnehmer',
};
const TOURNAMENT_TABS = new Set(['overview', 'rules', 'members', 'teams', 'matches', 'pool', 'draft', 'champions', 'settings']);

function updatePrimaryNavigation() {
  const path = location.hash.replace(/^#\/?/, '');
  const parts = path.split('/').filter(Boolean);
  let active = 'dashboard';
  if (parts[0] === 'section') active = parts[1] || 'dashboard';
  if (NAV_LABELS[parts[0]]) active = parts[0];
  if (parts[0] === 'builder') active = 'builder';
  if (parts[0] === 't') active = parts[2] || 'tournaments';
  const activeNav = TOURNAMENT_TABS.has(active) ? 'tournaments' : active;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    const selected = item.dataset.nav === (activeNav === 'builder' ? 'teams' : activeNav);
    item.classList.toggle('active', selected);
    if (selected) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const title = document.getElementById('topbar-view-name');
  if (title) title.textContent = NAV_LABELS[active] || 'Dashboard';
}

async function navigateToTournamentTab(tab) {
  try {
    const tournaments = await listMyTournaments();
    const lastSlug = localStorage.getItem('ots:last-tournament-slug');
    const tournament = tournaments.find(t => t.slug === lastSlug)
      || tournaments.find(t => t.status === 'active')
      || tournaments.find(t => t.status === 'setup')
      || tournaments[0];
    if (!tournament) {
      toast('Lege zuerst ein Turnier an oder tritt einem Turnier bei.', 'error');
      navigate('/tournaments');
      return;
    }
    if (tab === 'settings' && tournament.my_role !== 'host') {
      toast('Turniereinstellungen sind nur für Hosts verfügbar.', 'error');
      navigate(`/t/${tournament.slug}/overview`);
      return;
    }
    localStorage.setItem('ots:last-tournament-slug', tournament.slug);
    navigate(`/t/${tournament.slug}/${tab}`);
  } catch (err) {
    toast('Turnierbereich konnte nicht geöffnet werden: ' + err.message, 'error');
  }
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
}

async function boot() {
  initModalBackdrops();
  initProfileSelectorUi();
  initLoginUi();

  const menuTrigger = document.getElementById('user-menu-trigger');
  const menuPopover = document.getElementById('user-menu-popover');
  menuTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = menuPopover?.classList.toggle('open');
    menuTrigger.setAttribute('aria-expanded', String(Boolean(open)));
  });
  document.addEventListener('click', () => {
    menuPopover?.classList.remove('open');
    menuTrigger?.setAttribute('aria-expanded', 'false');
  });
  const sidebar = document.getElementById('app-sidebar');
  const mobileMenu = document.getElementById('mobile-menu-button');
  mobileMenu?.addEventListener('click', () => {
    const open = sidebar?.classList.toggle('open');
    mobileMenu.setAttribute('aria-expanded', String(Boolean(open)));
  });
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.addEventListener('click', async (event) => {
    sidebar?.classList.remove('open');
    mobileMenu?.setAttribute('aria-expanded', 'false');
    if (item.dataset.tournamentTab) {
      event.preventDefault();
      await navigateToTournamentTab(item.dataset.tournamentTab);
    }
  }));
  window.openTournamentArea = navigateToTournamentTab;
  window.addEventListener('hashchange', updatePrimaryNavigation);
  updatePrimaryNavigation();

  try {
    await initAuth();
  } catch (err) {
    document.getElementById('app-root').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Verbindung zu Supabase fehlgeschlagen</div>
        <div style="font-size:13px;color:var(--text-muted);max-width:480px;margin:0 auto">
          Bitte prüfe SUPABASE_URL / SUPABASE_ANON_KEY in <code>js/config.js</code> und ob das
          Schema (SUPABASE_SCHEMA.sql) im Projekt eingespielt wurde.<br><br>${err.message}
        </div>
      </div>`;
    return;
  }

  const publicTeamMatch = location.hash.match(/^#\/public-team\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  if (publicTeamMatch) {
    document.body.classList.add('public-team-mode');
    await renderPublicTeamPage(document.getElementById('app-root'), publicTeamMatch[1]);
    return;
  }

  initProfileFeature();
  const selectedProfile = await ensureLoggedIn();
  if (!selectedProfile) return;
  initProfileFeature();
  initDashboardFeature();
  maybePromptDisplayName();

  onRoute('/', async () => {
    showView('dashboard');
    hideTournamentContextBar();
    await renderDashboard();
  });
  onRoute('/section/:section', async (params) => {
    showView('dashboard');
    hideTournamentContextBar();
    await renderDashboard(params.section);
  });
  onRoute('/tournaments', async () => {
    showView('hub');
    hideTournamentContextBar();
    await renderTournamentsPage(document.getElementById('view-hub'));
  });
  onRoute('/teams', async () => {
    showView('hub');
    hideTournamentContextBar();
    await renderTeamsPage(document.getElementById('view-hub'));
  });
  onRoute('/templates', async () => {
    showView('hub');
    hideTournamentContextBar();
    await renderTemplatesPage(document.getElementById('view-hub'));
  });
  onRoute('/champions', async () => {
    showView('hub');
    hideTournamentContextBar();
    await renderChampionsPage(document.getElementById('view-hub'));
  });
  onRoute('/builder/:sheetId', async (params) => {
    showView('hub');
    hideTournamentContextBar();
    await renderTeamBuilderPage(document.getElementById('view-hub'), params.sheetId);
  });
  onRoute('/t/:slug', async (params) => {
    showView('tournament');
    await renderTournamentRoute(params, 'overview');
  });
  onRoute('/t/:slug/:tab', async (params) => {
    showView('tournament');
    await renderTournamentRoute(params, params.tab);
  });
  onNotFound(() => { location.hash = '/'; });

  startRouter();
}

boot();
