-- ============================================================================
-- OTS MVP Login/Profile Migration
-- ============================================================================
-- Fuehre diese Datei im Supabase SQL Editor aus, nachdem SUPABASE_SCHEMA.sql
-- bereits eingespielt wurde.
--
-- Ziel:
-- - Username+Passwort Login ueber Supabase Auth.
-- - UI-Username wird intern zu username@pokemon-draft.local.
-- - profiles bleiben mit bestehenden FKs kompatibel: profiles.id bleibt stabil.
-- - user_id, username und global_role werden ergaenzt.
-- ============================================================================

alter table profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table profiles add column if not exists username text;
alter table profiles add column if not exists showdown_name text;
alter table profiles add column if not exists discord_name text;
alter table profiles add column if not exists global_role text not null default 'user'
  check (global_role in ('admin','user'));

update profiles
set user_id = id
where user_id is null;

update profiles p
set username = lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_-]', '', 'g'))
from auth.users u
where p.user_id = u.id
  and (p.username is null or p.username = '');

update profiles
set username = 'trainer-' || substr(id::text, 1, 8)
where username is null or username = '';

create unique index if not exists profiles_user_id_unique on profiles(user_id);
create unique index if not exists profiles_username_unique on profiles(username);

alter table profiles alter column user_id set not null;
alter table profiles alter column username set not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
  v_display_name text;
begin
  v_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_-]', '', 'g'));
  if v_username is null or v_username = '' then
    v_username := 'trainer-' || substr(new.id::text, 1, 8);
  end if;

  v_display_name := coalesce(new.raw_user_meta_data->>'display_name', v_username);

  insert into public.profiles (id, user_id, username, display_name, global_role)
  values (new.id, new.id, v_username, v_display_name, 'user')
  on conflict (id) do update
    set user_id = excluded.user_id,
        username = coalesce(public.profiles.username, excluded.username),
        display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);

  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.user_id = auth.uid()
      and p.global_role = 'admin'
  );
$$;

-- Public/unlisted Inhalte bleiben privat fuer eingeloggte Nutzer.
-- Ohne Login soll keine App-Datenliste sichtbar sein.
drop policy if exists "tournaments_select_visible" on tournaments;
create policy "tournaments_select_visible" on tournaments for select
  using (
    auth.uid() is not null
    and (
      public.is_admin()
      or visibility in ('public','unlisted')
      or owner_id = auth.uid()
      or is_member_of(id)
    )
  );

drop policy if exists "profiles_select_public_directory" on profiles;
create policy "profiles_select_public_directory" on profiles for select
  using (auth.uid() is not null);

-- Admin-Policies additiv zu den bestehenden Policies. Sie erweitern Zugriff,
-- ohne bestehende Host/Player/Viewer-Regeln zu entfernen.
drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_all" on profiles for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tournaments_admin_all" on tournaments;
create policy "tournaments_admin_all" on tournaments for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "members_admin_all" on tournament_members;
create policy "members_admin_all" on tournament_members for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pools_admin_all" on draft_pools;
create policy "pools_admin_all" on draft_pools for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pool_pokemon_admin_all" on draft_pool_pokemon;
create policy "pool_pokemon_admin_all" on draft_pool_pokemon for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "rulesets_admin_all" on rulesets;
create policy "rulesets_admin_all" on rulesets for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "sheets_admin_all" on team_sheets;
create policy "sheets_admin_all" on team_sheets for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "sets_admin_all" on pokemon_sets;
create policy "sets_admin_all" on pokemon_sets for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "matches_admin_all" on matches;
create policy "matches_admin_all" on matches for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "invites_admin_all" on invite_codes;
create policy "invites_admin_all" on invite_codes for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "draft_sessions_admin_all" on draft_sessions;
create policy "draft_sessions_admin_all" on draft_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "draft_picks_admin_all" on draft_picks;
create policy "draft_picks_admin_all" on draft_picks for all
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
