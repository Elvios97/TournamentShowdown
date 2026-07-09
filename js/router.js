// ─── ROUTER ─────────────────────────────────────────────────────────
// Bewusst simpler Hash-Router (#/ , #/t/slug , #/t/slug/tab), damit die
// App ohne Server-Rewrite-Konfiguration auf jedem statischen Hoster
// (GitHub Pages, Netlify, Supabase Storage, ...) läuft.

const routes = [];
let notFoundHandler = () => {};

export function onRoute(pattern, handler) {
  // pattern: '/' | '/t/:slug' | '/t/:slug/:tab'
  const parts = pattern.split('/').filter(Boolean);
  routes.push({ parts, handler });
}

export function onNotFound(handler) { notFoundHandler = handler; }

function matchRoute(pathParts) {
  for (const r of routes) {
    if (r.parts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const rp = r.parts[i];
      if (rp.startsWith(':')) params[rp.slice(1)] = decodeURIComponent(pathParts[i]);
      else if (rp !== pathParts[i]) { ok = false; break; }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

function currentPathParts() {
  const hash = location.hash.replace(/^#/, '') || '/';
  return hash.split('/').filter(Boolean);
}

function dispatch() {
  const parts = currentPathParts();
  const match = matchRoute(parts);
  if (match) match.handler(match.params);
  else notFoundHandler();
}

export function navigate(path) {
  if (location.hash.replace(/^#/, '') === path) { dispatch(); return; }
  location.hash = path;
}

export function startRouter() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}

export function currentParams() {
  const parts = currentPathParts();
  const match = matchRoute(parts);
  return match ? match.params : {};
}
