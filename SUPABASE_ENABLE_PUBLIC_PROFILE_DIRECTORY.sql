-- Optional: Profile im Profil-Wechsel und bei public Team Sheets sichtbar machen.
--
-- Zweck:
-- - Die Web-App kann alle Profile als Verzeichnis anzeigen.
-- - Public Team Sheets koennen den Anzeigenamen des Besitzers anzeigen.
--
-- Wichtig:
-- - Diese Policy macht Profile fuer eingeloggte User zeilenweise lesbar.
-- - Die App fragt nur id, user_id, display_name, created_at und updated_at ab.
-- - Das erlaubt keinen Profilwechsel ohne passende Supabase Auth-Session.
-- - Keine Service-Role-Keys im Frontend verwenden.

drop policy if exists "profiles_select_public_directory" on profiles;

create policy "profiles_select_public_directory"
  on profiles for select
  using (auth.uid() is not null);
