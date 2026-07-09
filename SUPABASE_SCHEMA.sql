-- ============================================================================
-- OTS / Drafting & Tournament Tool — Supabase Schema
-- ============================================================================
-- Führe dieses Skript im Supabase SQL Editor aus (oder als Migration via CLI).
-- Reihenfolge: Extensions -> Tabellen -> Indizes -> Trigger -> RLS -> Policies
-- -> RPC-Funktionen.
--
-- Sicherheitsmodell (Kurzfassung):
--  - Auth: Supabase Anonymous Auth. Jeder Browser bekommt einen auth.users-
--    Eintrag (is_anonymous = true), ohne dass der Nutzer ein Passwort/Mail
--    angeben muss. profiles.id == auth.uid().
--  - Turniere kennen drei Sichtbarkeiten: private (nur Mitglieder),
--    unlisted (per Link/Code lesbar, aber nicht gelistet), public (gelistet).
--  - Innerhalb eines Turniers gilt: Mitglieder sehen turniergebundene Daten,
--    Host/Admin darf verwalten, Spieler dürfen nur ihr eigenes Team Sheet
--    bearbeiten, Viewer sehen nur freigegebene Inhalte.
--  - Invite-Codes werden NICHT per Tabellen-SELECT öffentlich preisgegeben.
--    Das Beitreten läuft über die RPC-Funktion `redeem_invite_code`, die
--    SECURITY DEFINER nutzt und serverseitig validiert.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- helper: updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- PROFILES
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Trainer',
  avatar_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Wenn sich ein neuer (auch anonymer) User registriert, automatisch ein Profil anlegen.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Trainer-' || substr(new.id::text, 1, 4))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- TOURNAMENTS
-- ============================================================================
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text default '',
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  status text not null default 'setup' check (status in ('setup','active','completed')),
  owner_id uuid not null references profiles(id) on delete cascade,
  ruleset_id uuid,
  draft_pool_id uuid,
  show_open_sheets boolean not null default true,
  hide_teams_until_start boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_tournaments_updated_at
  before update on tournaments
  for each row execute function set_updated_at();

create index if not exists idx_tournaments_owner on tournaments(owner_id);
create index if not exists idx_tournaments_visibility on tournaments(visibility);

-- ============================================================================
-- TOURNAMENT MEMBERS
-- ============================================================================
create table if not exists tournament_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'player' check (role in ('host','player','viewer')),
  player_name text,
  team_name text,
  joined_at timestamptz not null default now(),
  unique (tournament_id, profile_id)
);

create index if not exists idx_members_tournament on tournament_members(tournament_id);
create index if not exists idx_members_profile on tournament_members(profile_id);

-- ============================================================================
-- DRAFT POOLS
-- ============================================================================
create table if not exists draft_pools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  description text default '',
  is_template boolean not null default false,
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_pools_updated_at
  before update on draft_pools
  for each row execute function set_updated_at();

create index if not exists idx_pools_tournament on draft_pools(tournament_id);
create index if not exists idx_pools_owner on draft_pools(owner_id);

create table if not exists draft_pool_pokemon (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references draft_pools(id) on delete cascade,
  pokemon_id text not null,
  pokemon_name text not null,
  types text[] not null default '{}',
  generation int,
  tier text,
  cost int,
  tags text[] not null default '{}',
  is_banned boolean not null default false,
  notes text default ''
);

create index if not exists idx_pool_pokemon_pool on draft_pool_pokemon(pool_id);

-- ============================================================================
-- RULESETS
-- ============================================================================
create table if not exists rulesets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  format text not null default 'singles' check (format in ('singles','doubles','vgc','custom')),
  draft_mode text not null default 'none' check (draft_mode in ('none','snake','linear','random')),
  team_size int not null default 6,
  player_count int,
  allow_duplicates boolean not null default false,
  points_budget int,
  banned_tags text[] not null default '{}',
  allowed_tags text[] not null default '{}',
  free_text_rules text default '',
  is_template boolean not null default false,
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_rulesets_updated_at
  before update on rulesets
  for each row execute function set_updated_at();

create index if not exists idx_rulesets_tournament on rulesets(tournament_id);
create index if not exists idx_rulesets_owner on rulesets(owner_id);

-- Jetzt, da rulesets/draft_pools existieren, FKs auf tournaments nachrüsten:
alter table tournaments
  drop constraint if exists tournaments_ruleset_id_fkey,
  add constraint tournaments_ruleset_id_fkey foreign key (ruleset_id) references rulesets(id) on delete set null;
alter table tournaments
  drop constraint if exists tournaments_draft_pool_id_fkey,
  add constraint tournaments_draft_pool_id_fkey foreign key (draft_pool_id) references draft_pools(id) on delete set null;

-- ============================================================================
-- TEAM SHEETS / POKEMON SETS  (Open Team Sheets)
-- ============================================================================
create table if not exists team_sheets (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  member_id uuid references tournament_members(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  ruleset_id uuid references rulesets(id) on delete set null,
  title text not null default 'Team',
  is_locked boolean not null default false,
  visibility text not null default 'tournament' check (visibility in ('private','tournament','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_team_sheets_updated_at
  before update on team_sheets
  for each row execute function set_updated_at();

create index if not exists idx_sheets_tournament on team_sheets(tournament_id);
create index if not exists idx_sheets_profile on team_sheets(profile_id);
create index if not exists idx_sheets_member on team_sheets(member_id);
create index if not exists idx_sheets_ruleset on team_sheets(ruleset_id) where ruleset_id is not null;

create table if not exists pokemon_sets (
  id uuid primary key default gen_random_uuid(),
  team_sheet_id uuid not null references team_sheets(id) on delete cascade,
  pokemon_id text not null,
  pokemon_name text not null,
  nickname text,
  item text,
  ability text,
  tera_type text,
  nature text,
  evs jsonb not null default '{}'::jsonb,
  moves text[] not null default '{}',
  notes text default '',
  sort_order int not null default 0
);

create index if not exists idx_sets_sheet on pokemon_sets(team_sheet_id);

-- ============================================================================
-- MATCHES
-- ============================================================================
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round int not null default 1,
  player_a_member_id uuid references tournament_members(id) on delete set null,
  player_b_member_id uuid references tournament_members(id) on delete set null,
  score_a int,
  score_b int,
  winner_member_id uuid references tournament_members(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','completed')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_matches_updated_at
  before update on matches
  for each row execute function set_updated_at();

create index if not exists idx_matches_tournament on matches(tournament_id);

-- ============================================================================
-- INVITE CODES  (nicht direkt per SELECT öffentlich lesbar -> siehe RPC unten)
-- ============================================================================
create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  code text not null,
  role text not null default 'player' check (role in ('host','player','viewer')),
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, code)
);

create index if not exists idx_invites_tournament on invite_codes(tournament_id);

-- ============================================================================
-- DRAFT SESSIONS / PICKS  (Platzhalter für späteres Live-Drafting)
-- ============================================================================
create table if not exists draft_sessions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  pool_id uuid references draft_pools(id) on delete set null,
  ruleset_id uuid references rulesets(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','paused','completed')),
  current_pick_index int not null default 0,
  pick_order uuid[] not null default '{}', -- Reihenfolge von tournament_members.id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_draft_sessions_updated_at
  before update on draft_sessions
  for each row execute function set_updated_at();

create table if not exists draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_session_id uuid not null references draft_sessions(id) on delete cascade,
  member_id uuid not null references tournament_members(id) on delete cascade,
  pokemon_id text not null,
  pokemon_name text not null,
  pick_number int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_picks_session on draft_picks(draft_session_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table tournaments enable row level security;
alter table tournament_members enable row level security;
alter table draft_pools enable row level security;
alter table draft_pool_pokemon enable row level security;
alter table rulesets enable row level security;
alter table team_sheets enable row level security;
alter table pokemon_sets enable row level security;
alter table matches enable row level security;
alter table invite_codes enable row level security;
alter table draft_sessions enable row level security;
alter table draft_picks enable row level security;

-- ----------------------------------------------------------------------------
-- Helper-Funktionen für Policies (vermeiden rekursive RLS-Probleme)
-- ----------------------------------------------------------------------------
create or replace function is_member_of(p_tournament_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from tournament_members m
    where m.tournament_id = p_tournament_id and m.profile_id = auth.uid()
  );
$$;

create or replace function is_host_of(p_tournament_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from tournament_members m
    where m.tournament_id = p_tournament_id
      and m.profile_id = auth.uid()
      and m.role = 'host'
  ) or exists (
    select 1 from tournaments t
    where t.id = p_tournament_id and t.owner_id = auth.uid()
  );
$$;

create or replace function tournament_visibility(p_tournament_id uuid)
returns text language sql security definer stable as $$
  select visibility from tournaments where id = p_tournament_id;
$$;

-- ----------------------------------------------------------------------------
-- PROFILES policies
-- ----------------------------------------------------------------------------
create policy "profiles_select_own_or_in_shared_tournament"
  on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from tournament_members m1
      join tournament_members m2 on m1.tournament_id = m2.tournament_id
      where m1.profile_id = profiles.id and m2.profile_id = auth.uid()
    )
  );

create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- TOURNAMENTS policies
-- ----------------------------------------------------------------------------
create policy "tournaments_select_visible"
  on tournaments for select
  using (
    visibility in ('public','unlisted')
    or owner_id = auth.uid()
    or is_member_of(id)
  );

create policy "tournaments_insert_own"
  on tournaments for insert
  with check (owner_id = auth.uid());

create policy "tournaments_update_host_only"
  on tournaments for update
  using (owner_id = auth.uid() or is_host_of(id))
  with check (owner_id = auth.uid() or is_host_of(id));

create policy "tournaments_delete_owner_only"
  on tournaments for delete
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- TOURNAMENT_MEMBERS policies
-- ----------------------------------------------------------------------------
create policy "members_select_within_tournament"
  on tournament_members for select
  using (
    is_member_of(tournament_id)
    or is_host_of(tournament_id)
    or exists (select 1 from tournaments t where t.id = tournament_id and t.visibility in ('public','unlisted'))
  );

-- Eigener Beitritt nur, wenn Turnier public ist (sonst über RPC redeem_invite_code).
create policy "members_insert_self_public_tournament"
  on tournament_members for insert
  with check (
    profile_id = auth.uid()
    and exists (select 1 from tournaments t where t.id = tournament_id and t.visibility = 'public')
  );

-- Ersteller eines Turniers darf sich selbst als Host-Mitglied eintragen.
-- Nötig für private/unlisted Turniere, die nicht über Public-Join laufen.
create policy "members_insert_owner_as_host"
  on tournament_members for insert
  with check (
    profile_id = auth.uid()
    and role = 'host'
    and exists (
      select 1 from tournaments t
      where t.id = tournament_id and t.owner_id = auth.uid()
    )
  );

-- Owner kann sich bei Bedarf bewusst als Spieler eintragen, z. B. um ein
-- eigenes Open Team Sheet im Turnier zu führen. Das passiert nicht automatisch.
create policy "members_insert_owner_as_player"
  on tournament_members for insert
  with check (
    profile_id = auth.uid()
    and role = 'player'
    and is_host_of(tournament_id)
  );

create policy "members_update_self_or_host"
  on tournament_members for update
  using (profile_id = auth.uid() or is_host_of(tournament_id))
  with check (profile_id = auth.uid() or is_host_of(tournament_id));

create policy "members_delete_self_or_host"
  on tournament_members for delete
  using (profile_id = auth.uid() or is_host_of(tournament_id));

-- ----------------------------------------------------------------------------
-- DRAFT_POOLS policies
-- ----------------------------------------------------------------------------
create policy "pools_select_visible"
  on draft_pools for select
  using (
    (is_template and visibility = 'public')
    or owner_id = auth.uid()
    or (tournament_id is not null and is_member_of(tournament_id))
  );

create policy "pools_insert_owner"
  on draft_pools for insert
  with check (
    owner_id = auth.uid()
    and (tournament_id is null or is_host_of(tournament_id))
  );

create policy "pools_update_owner_or_host"
  on draft_pools for update
  using (owner_id = auth.uid() or (tournament_id is not null and is_host_of(tournament_id)))
  with check (owner_id = auth.uid() or (tournament_id is not null and is_host_of(tournament_id)));

create policy "pools_delete_owner_or_host"
  on draft_pools for delete
  using (owner_id = auth.uid() or (tournament_id is not null and is_host_of(tournament_id)));

-- ----------------------------------------------------------------------------
-- DRAFT_POOL_POKEMON policies (folgt Sichtbarkeit des Pools)
-- ----------------------------------------------------------------------------
create policy "pool_pokemon_select_via_pool"
  on draft_pool_pokemon for select
  using (
    exists (
      select 1 from draft_pools p
      where p.id = pool_id
        and (
          (p.is_template and p.visibility = 'public')
          or p.owner_id = auth.uid()
          or (p.tournament_id is not null and is_member_of(p.tournament_id))
        )
    )
  );

create policy "pool_pokemon_write_via_pool_owner_or_host"
  on draft_pool_pokemon for all
  using (
    exists (
      select 1 from draft_pools p
      where p.id = pool_id
        and (p.owner_id = auth.uid() or (p.tournament_id is not null and is_host_of(p.tournament_id)))
    )
  )
  with check (
    exists (
      select 1 from draft_pools p
      where p.id = pool_id
        and (p.owner_id = auth.uid() or (p.tournament_id is not null and is_host_of(p.tournament_id)))
    )
  );

-- ----------------------------------------------------------------------------
-- RULESETS policies (analog zu draft_pools)
-- ----------------------------------------------------------------------------
create policy "rulesets_select_visible"
  on rulesets for select
  using (
    (is_template and visibility = 'public')
    or owner_id = auth.uid()
    or (tournament_id is not null and is_member_of(tournament_id))
  );

create policy "rulesets_insert_owner"
  on rulesets for insert
  with check (
    owner_id = auth.uid()
    and (tournament_id is null or is_host_of(tournament_id))
  );

create policy "rulesets_update_owner_or_host"
  on rulesets for update
  using (owner_id = auth.uid() or (tournament_id is not null and is_host_of(tournament_id)))
  with check (owner_id = auth.uid() or (tournament_id is not null and is_host_of(tournament_id)));

create policy "rulesets_delete_owner_or_host"
  on rulesets for delete
  using (owner_id = auth.uid() or (tournament_id is not null and is_host_of(tournament_id)));

-- ----------------------------------------------------------------------------
-- TEAM_SHEETS policies
-- ----------------------------------------------------------------------------
create policy "sheets_select_scoped"
  on team_sheets for select
  using (
    profile_id = auth.uid()
    or (tournament_id is not null and is_host_of(tournament_id))
    or (visibility = 'public')
    or (tournament_id is not null and visibility = 'tournament' and is_member_of(tournament_id))
  );

create policy "sheets_insert_own"
  on team_sheets for insert
  with check (
    profile_id = auth.uid()
    and (
      (tournament_id is null and member_id is null and visibility = 'private')
      or (tournament_id is not null and member_id is not null and is_member_of(tournament_id))
    )
  );

create policy "sheets_update_own_unlocked_or_host"
  on team_sheets for update
  using (
    (profile_id = auth.uid() and not is_locked)
    or (tournament_id is not null and is_host_of(tournament_id))
  )
  with check (
    (profile_id = auth.uid())
    or (tournament_id is not null and is_host_of(tournament_id))
  );

create policy "sheets_delete_own_or_host"
  on team_sheets for delete
  using (profile_id = auth.uid() or (tournament_id is not null and is_host_of(tournament_id)));

-- ----------------------------------------------------------------------------
-- POKEMON_SETS policies (folgen dem Team Sheet)
-- ----------------------------------------------------------------------------
create policy "sets_select_via_sheet"
  on pokemon_sets for select
  using (
    exists (
      select 1 from team_sheets s
      where s.id = team_sheet_id
        and (
          s.profile_id = auth.uid()
          or (s.tournament_id is not null and is_host_of(s.tournament_id))
          or s.visibility = 'public'
          or (s.tournament_id is not null and s.visibility = 'tournament' and is_member_of(s.tournament_id))
        )
    )
  );

create policy "sets_write_via_sheet_owner_unlocked_or_host"
  on pokemon_sets for all
  using (
    exists (
      select 1 from team_sheets s
      where s.id = team_sheet_id
        and ((s.profile_id = auth.uid() and not s.is_locked) or (s.tournament_id is not null and is_host_of(s.tournament_id)))
    )
  )
  with check (
    exists (
      select 1 from team_sheets s
      where s.id = team_sheet_id
        and ((s.profile_id = auth.uid() and not s.is_locked) or (s.tournament_id is not null and is_host_of(s.tournament_id)))
    )
  );

-- ----------------------------------------------------------------------------
-- MATCHES policies
-- ----------------------------------------------------------------------------
create policy "matches_select_members"
  on matches for select
  using (is_member_of(tournament_id) or is_host_of(tournament_id));

create policy "matches_write_host_only"
  on matches for all
  using (is_host_of(tournament_id))
  with check (is_host_of(tournament_id));

-- ----------------------------------------------------------------------------
-- INVITE_CODES policies
-- ----------------------------------------------------------------------------
-- Bewusst KEIN allgemeines SELECT für Mitglieder/Public — Codes sind sonst
-- für jeden mit Lesezugriff auf das Turnier einsehbar. Nur der Host darf
-- seine eigenen Invite-Codes verwalten/sehen. Der Beitritt läuft über die
-- RPC-Funktion redeem_invite_code() weiter unten (SECURITY DEFINER).
create policy "invites_select_host_only"
  on invite_codes for select
  using (is_host_of(tournament_id));

create policy "invites_write_host_only"
  on invite_codes for all
  using (is_host_of(tournament_id))
  with check (is_host_of(tournament_id));

-- ----------------------------------------------------------------------------
-- DRAFT_SESSIONS / DRAFT_PICKS policies (Platzhalter, schon scoped)
-- ----------------------------------------------------------------------------
create policy "draft_sessions_select_members"
  on draft_sessions for select
  using (is_member_of(tournament_id) or is_host_of(tournament_id));

create policy "draft_sessions_write_host_only"
  on draft_sessions for all
  using (is_host_of(tournament_id))
  with check (is_host_of(tournament_id));

create policy "draft_picks_select_via_session"
  on draft_picks for select
  using (
    exists (
      select 1 from draft_sessions ds
      where ds.id = draft_session_id
        and (is_member_of(ds.tournament_id) or is_host_of(ds.tournament_id))
    )
  );

create policy "draft_picks_write_host_only"
  on draft_picks for all
  using (
    exists (
      select 1 from draft_sessions ds
      where ds.id = draft_session_id and is_host_of(ds.tournament_id)
    )
  )
  with check (
    exists (
      select 1 from draft_sessions ds
      where ds.id = draft_session_id and is_host_of(ds.tournament_id)
    )
  );

-- ============================================================================
-- RPC: Turnier erstellen
-- ============================================================================
-- Legt bewusst nur den Turnier-Datensatz an. Teilnehmer/Mitgliedschaften
-- werden danach separat über Einladungscodes oder bewussten Self-Join geregelt.
create or replace function create_tournament_with_host(
  p_slug text,
  p_name text,
  p_description text default '',
  p_visibility text default 'private',
  p_show_open_sheets boolean default true,
  p_hide_teams_until_start boolean default false
)
returns tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament tournaments;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into tournaments (
    slug,
    name,
    description,
    visibility,
    owner_id,
    show_open_sheets,
    hide_teams_until_start
  )
  values (
    p_slug,
    p_name,
    coalesce(p_description, ''),
    coalesce(p_visibility, 'private'),
    auth.uid(),
    coalesce(p_show_open_sheets, true),
    coalesce(p_hide_teams_until_start, false)
  )
  returning * into v_tournament;

  return v_tournament;
end;
$$;

grant execute on function create_tournament_with_host(
  text,
  text,
  text,
  text,
  boolean,
  boolean
) to authenticated;

grant execute on function create_tournament_with_host(
  text,
  text,
  text,
  text,
  boolean,
  boolean
) to anon;

notify pgrst, 'reload schema';

-- ============================================================================
-- RPC: Invite-Code einlösen
-- ============================================================================
-- SECURITY DEFINER, damit die Funktion trotz restriktiver invite_codes-Policy
-- den Code serverseitig prüfen kann, ohne dass das Frontend die Tabelle lesen
-- muss. Validiert Ablaufdatum + max_uses und legt/aktualisiert die Membership
-- des aktuell angemeldeten (auch anonymen) Users an.
create or replace function redeem_invite_code(p_code text)
returns table (tournament_id uuid, tournament_slug text, role text)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
  v_slug text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite from invite_codes ic where upper(ic.code) = upper(p_code) limit 1;
  if v_invite.id is null then
    raise exception 'invalid_code';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'code_expired';
  end if;

  if v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    raise exception 'code_exhausted';
  end if;

  select display_name into v_display_name
  from profiles
  where id = auth.uid();

  insert into tournament_members (tournament_id, profile_id, role, player_name)
  values (v_invite.tournament_id, auth.uid(), v_invite.role, v_display_name)
  on conflict (tournament_id, profile_id) do update
    set role = case when tournament_members.role = 'host' then tournament_members.role else excluded.role end,
        player_name = coalesce(nullif(tournament_members.player_name, ''), excluded.player_name);

  update invite_codes set used_count = used_count + 1 where id = v_invite.id;

  select slug into v_slug from tournaments where id = v_invite.tournament_id;

  return query select v_invite.tournament_id, v_slug, v_invite.role;
end;
$$;

revoke all on function redeem_invite_code(text) from public;
grant execute on function redeem_invite_code(text) to authenticated, anon;

-- ============================================================================
-- Ende des Schemas
-- ============================================================================
