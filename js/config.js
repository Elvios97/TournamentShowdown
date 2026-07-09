// KONFIGURATION
// WICHTIG: Hier duerfen NUR oeffentliche Werte stehen.
//
// - SUPABASE_URL: die URL deines Supabase-Projekts
// - SUPABASE_ANON_KEY: der anon/publishable Key aus Supabase Settings -> API
//
// Niemals den service_role Key hier eintragen. Der gehoert niemals ins
// Frontend. Diese Werte sind bewusst nicht geheim: Der anon/publishable Key
// darf oeffentlich sein, weil der Datenzugriff ueber Row Level Security
// abgesichert wird.

export const SUPABASE_URL = 'https://akqgtztsorgbkvfbnqal.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_UXEtcLl_77MKLpcJz8GGIA_zahZ5Cts';

// Optional: Basis-Pfad, falls die App nicht im Webroot liegt.
export const BASE_PATH = '';
