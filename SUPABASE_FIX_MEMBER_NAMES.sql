-- Fix: Backfill missing participant names and make invite joins store a name.
--
-- Run this in the Supabase SQL Editor.

update tournament_members m
set player_name = p.display_name
from profiles p
where m.profile_id = p.id
  and (m.player_name is null or btrim(m.player_name) = '')
  and p.display_name is not null
  and btrim(p.display_name) <> '';

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

  select * into v_invite
  from invite_codes
  where upper(code) = upper(p_code)
  limit 1;

  if not found then
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

notify pgrst, 'reload schema';
