// SUPABASE CLIENT
// Laedt supabase-js direkt per ESM-CDN. Kein npm install oder Build-Schritt
// noetig; die App bleibt per einfachem statischen Server startbar.


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;

export function getSupabase() {
  if (client) return client;

  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT')) {
    console.warn('[supabaseClient] Bitte SUPABASE_URL / SUPABASE_ANON_KEY in js/config.js eintragen.');
  }

  if (isServiceRoleKey(SUPABASE_ANON_KEY)) {
    throw new Error('Unsichere Supabase-Konfiguration: Im Frontend darf nur der anon/publishable Key stehen.');
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

function isServiceRoleKey(key) {
  if (/service[_-]?role/i.test(String(key || ''))) return true;
  const parts = String(key || '').split('.');
  if (parts.length < 2) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}
