-- Fix: Invite-Code Beitritt fuer Username/Passwort-Login.
--
-- Problem:
-- - Nach der Login-Migration kann profiles.id von auth.uid() abweichen.
-- - tournament_members.profile_id verweist aber auf profiles.id.
-- - Die alte redeem_invite_code() Funktion hat direkt auth.uid() eingetragen.
--
-- Diese Version sucht zuerst das passende Profil zur aktuellen Auth-Session
-- und verwendet dann profiles.id fuer die Mitgliedschaft.

drop function if exists redeem_invite_code(text);

create function redeem_invite_code(p_code text)
returns table (result_tournament_id uuid, tournament_slug text, result_role text)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
  v_slug text;
  v_profile_id uuid;
  v_display_name text;
  v_already_member boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select p.id, p.display_name
    into v_profile_id, v_display_name
  from profiles p
  where p.user_id = auth.uid()
     or p.id = auth.uid()
  order by case when p.user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_profile_id is null then
    raise exception 'profile_missing';
  end if;

  select * into v_invite
  from invite_codes
  where upper(code) = upper(btrim(p_code))
  limit 1;

  if not found then
    raise exception 'invalid_code';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'code_expired';
  end if;

  select exists (
    select 1
    from tournament_members
    where tournament_members.tournament_id = v_invite.tournament_id
      and tournament_members.profile_id = v_profile_id
  ) into v_already_member;

  if not v_already_member
     and v_invite.max_uses is not null
     and v_invite.used_count >= v_invite.max_uses then
    raise exception 'code_exhausted';
  end if;

  insert into tournament_members (tournament_id, profile_id, role, player_name)
  values (v_invite.tournament_id, v_profile_id, v_invite.role, v_display_name)
  on conflict (tournament_id, profile_id) do update
    set role = case
          when tournament_members.role = 'host' then tournament_members.role
          else excluded.role
        end,
        player_name = coalesce(nullif(tournament_members.player_name, ''), excluded.player_name);

  if not v_already_member then
    update invite_codes
    set used_count = used_count + 1
    where id = v_invite.id;
  end if;

  select slug into v_slug
  from tournaments
  where id = v_invite.tournament_id;

  return query select v_invite.tournament_id, v_slug, v_invite.role;
end;
$$;

revoke all on function redeem_invite_code(text) from public;
grant execute on function redeem_invite_code(text) to authenticated;

notify pgrst, 'reload schema';
