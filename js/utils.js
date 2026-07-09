// ─── ALLGEMEINE HELPER ─────────────────────────────────────────────
// 1:1 aus dem ursprünglichen app.js übernommen, nur als ES-Module-Export.

export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initials(name) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

export function uid() {
  return (crypto?.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'turnier';
}

// ─── TOAST ───────────────────────────────────────────────────────
export function toast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) { console.log('[toast]', msg); return; }
  el.textContent = msg;
  el.className = 'toast show ' + (type || '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ─── MODALS ──────────────────────────────────────────────────────
export function openModal(id) {
  document.getElementById('modal-' + id)?.classList.add('open');
}
export function closeModal(id) {
  document.getElementById('modal-' + id)?.classList.remove('open');
}

export function initModalBackdrops() {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === e.currentTarget) o.classList.remove('open');
    });
  });
}

// openModal/closeModal werden in vielen Feature-Modulen per inline onclick=""
// aus generierten HTML-Strings aufgerufen (gleiches Muster wie im
// ursprünglichen app.js) -> global verfügbar machen.
window.openModal = openModal;
window.closeModal = closeModal;
