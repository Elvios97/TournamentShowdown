-- Draft-Hub: atomare Picks und direkte Pokemon-Tauschangebote.
-- Nach SUPABASE_SCHEMA.sql im Supabase SQL Editor ausfuehren.

create table if not exists trade_offers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  draft_session_id uuid not null references draft_sessions(id) on delete cascade,
  proposer_member_id uuid not null references tournament_members(id) on delete cascade,
  recipient_member_id uuid not null references tournament_members(id) on delete cascade,
  offered_pick_id uuid not null references draft_picks(id) on delete cascade,
  requested_pick_id uuid not null references draft_picks(id) on delete cascade,
  message text not null default '',
  status text not null default 'open' check (status in ('open','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (proposer_member_id <> recipient_member_id),
  check (offered_pick_id <> requested_pick_id)
);

create index if not exists idx_trade_offers_session_status on trade_offers(draft_session_id, status);
create index if not exists idx_trade_offers_recipient on trade_offers(recipient_member_id, status);
create index if not exists idx_trade_offers_proposer on trade_offers(proposer_member_id, status);
create unique index if not exists idx_trade_offers_open_pick
  on trade_offers(offered_pick_id) where status = 'open';

alter table trade_offers enable row level security;

drop policy if exists "trade offers readable by tournament members" on trade_offers;
create policy "trade offers readable by tournament members" on trade_offers
  for select using (is_member_of(tournament_id) or is_host_of(tournament_id));

create or replace function make_draft_pick(p_session_id uuid, p_pokemon_id text)
returns draft_picks
language plpgsql security definer set search_path = public as $$
declare
  v_session draft_sessions;
  v_rules rulesets;
  v_mon draft_pool_pokemon;
  v_pick draft_picks;
  v_player_count int;
  v_round int;
  v_position int;
  v_member_id uuid;
  v_spent int;
begin
  select * into v_session from draft_sessions where id = p_session_id for update;
  if not found or not is_host_of(v_session.tournament_id) then raise exception 'Keine Host-Berechtigung.'; end if;
  if v_session.status <> 'active' then raise exception 'Der Draft ist nicht aktiv.'; end if;

  select * into v_rules from rulesets where id = v_session.ruleset_id;
  select * into v_mon from draft_pool_pokemon
    where pool_id = v_session.pool_id and pokemon_id = p_pokemon_id and not is_banned;
  if not found then raise exception 'Pokemon ist nicht im aktiven Pool verfuegbar.'; end if;
  if exists (select 1 from draft_picks where draft_session_id = p_session_id and pokemon_id = p_pokemon_id)
     and not coalesce(v_rules.allow_duplicates, false) then raise exception 'Pokemon wurde bereits gepickt.'; end if;

  v_player_count := coalesce(array_length(v_session.pick_order, 1), 0);
  if v_player_count = 0 then raise exception 'Keine Pick-Reihenfolge hinterlegt.'; end if;
  v_round := v_session.current_pick_index / v_player_count;
  v_position := v_session.current_pick_index % v_player_count;
  if coalesce(v_rules.draft_mode, 'snake') = 'snake' and (v_round % 2) = 1 then
    v_member_id := v_session.pick_order[v_player_count - v_position];
  else
    v_member_id := v_session.pick_order[v_position + 1];
  end if;

  if (select count(*) from draft_picks where draft_session_id = p_session_id and member_id = v_member_id) >= coalesce(v_rules.team_size, 6)
    then raise exception 'Das Team ist bereits voll.'; end if;
  select coalesce(sum(coalesce(pp.cost, 0)), 0) into v_spent
    from draft_picks dp left join draft_pool_pokemon pp
      on pp.pool_id = v_session.pool_id and pp.pokemon_id = dp.pokemon_id
    where dp.draft_session_id = p_session_id and dp.member_id = v_member_id;
  if v_rules.points_budget is not null and v_spent + coalesce(v_mon.cost, 0) > v_rules.points_budget
    then raise exception 'Der Pick ueberschreitet das Punktebudget.'; end if;

  insert into draft_picks(draft_session_id, member_id, pokemon_id, pokemon_name, pick_number)
  values (p_session_id, v_member_id, v_mon.pokemon_id, v_mon.pokemon_name, v_session.current_pick_index + 1)
  returning * into v_pick;
  update draft_sessions set current_pick_index = current_pick_index + 1,
    status = case when current_pick_index + 1 >= v_player_count * coalesce(v_rules.team_size, 6) then 'completed' else status end
    where id = p_session_id;
  return v_pick;
end $$;

create or replace function undo_last_draft_pick(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_session draft_sessions; v_pick_id uuid;
begin
  select * into v_session from draft_sessions where id = p_session_id for update;
  if not found or not is_host_of(v_session.tournament_id) then raise exception 'Keine Host-Berechtigung.'; end if;
  select id into v_pick_id from draft_picks where draft_session_id = p_session_id order by pick_number desc limit 1;
  if v_pick_id is null then raise exception 'Noch kein Pick vorhanden.'; end if;
  delete from draft_picks where id = v_pick_id;
  update draft_sessions set current_pick_index = greatest(current_pick_index - 1, 0),
    status = case when status = 'completed' then 'active' else status end where id = p_session_id;
end $$;

create or replace function create_trade_offer(
  p_session_id uuid, p_recipient_member_id uuid, p_offered_pick_id uuid,
  p_requested_pick_id uuid, p_message text default ''
) returns trade_offers language plpgsql security definer set search_path = public as $$
declare v_session draft_sessions; v_proposer uuid; v_offer trade_offers;
begin
  select * into v_session from draft_sessions where id = p_session_id;
  select id into v_proposer from tournament_members
    where tournament_id = v_session.tournament_id and profile_id = auth.uid();
  if v_proposer is null then raise exception 'Du bist kein Turniermitglied.'; end if;
  if v_proposer = p_recipient_member_id then raise exception 'Ein Tausch mit dir selbst ist nicht moeglich.'; end if;
  if not exists (select 1 from tournament_members where id = p_recipient_member_id and tournament_id = v_session.tournament_id)
    then raise exception 'Empfaenger gehoert nicht zum Turnier.'; end if;
  if not exists (select 1 from draft_picks where id = p_offered_pick_id and draft_session_id = p_session_id and member_id = v_proposer)
    then raise exception 'Der angebotene Pick gehoert dir nicht.'; end if;
  if not exists (select 1 from draft_picks where id = p_requested_pick_id and draft_session_id = p_session_id and member_id = p_recipient_member_id)
    then raise exception 'Der gewuenschte Pick gehoert nicht zum Empfaenger.'; end if;
  insert into trade_offers(tournament_id, draft_session_id, proposer_member_id, recipient_member_id,
    offered_pick_id, requested_pick_id, message)
  values(v_session.tournament_id, p_session_id, v_proposer, p_recipient_member_id,
    p_offered_pick_id, p_requested_pick_id, left(coalesce(p_message, ''), 500)) returning * into v_offer;
  return v_offer;
end $$;

create or replace function resolve_trade_offer(p_offer_id uuid, p_action text)
returns trade_offers language plpgsql security definer set search_path = public as $$
declare
  v_offer trade_offers; v_session draft_sessions; v_rules rulesets;
  v_actor uuid; v_offered draft_picks; v_requested draft_picks;
  v_offered_cost int; v_requested_cost int; v_proposer_spent int; v_recipient_spent int;
begin
  select * into v_offer from trade_offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'open' then raise exception 'Das Angebot ist nicht mehr offen.'; end if;
  select id into v_actor from tournament_members where tournament_id = v_offer.tournament_id and profile_id = auth.uid();
  if p_action = 'withdraw' then
    if v_actor <> v_offer.proposer_member_id then raise exception 'Nur der Ersteller darf das Angebot zurueckziehen.'; end if;
    update trade_offers set status = 'withdrawn', resolved_at = now(), updated_at = now() where id = p_offer_id returning * into v_offer;
    return v_offer;
  end if;
  if v_actor <> v_offer.recipient_member_id then raise exception 'Nur der Empfaenger darf antworten.'; end if;
  if p_action = 'reject' then
    update trade_offers set status = 'rejected', resolved_at = now(), updated_at = now() where id = p_offer_id returning * into v_offer;
    return v_offer;
  end if;
  if p_action <> 'accept' then raise exception 'Unbekannte Aktion.'; end if;

  select * into v_session from draft_sessions where id = v_offer.draft_session_id;
  select * into v_rules from rulesets where id = v_session.ruleset_id;
  select * into v_offered from draft_picks where id = v_offer.offered_pick_id for update;
  select * into v_requested from draft_picks where id = v_offer.requested_pick_id for update;
  if v_offered.member_id <> v_offer.proposer_member_id or v_requested.member_id <> v_offer.recipient_member_id
    then raise exception 'Die Besitzverhaeltnisse haben sich geaendert.'; end if;
  select coalesce(cost, 0) into v_offered_cost from draft_pool_pokemon where pool_id = v_session.pool_id and pokemon_id = v_offered.pokemon_id;
  select coalesce(cost, 0) into v_requested_cost from draft_pool_pokemon where pool_id = v_session.pool_id and pokemon_id = v_requested.pokemon_id;
  select coalesce(sum(coalesce(pp.cost, 0)), 0) into v_proposer_spent from draft_picks dp left join draft_pool_pokemon pp
    on pp.pool_id = v_session.pool_id and pp.pokemon_id = dp.pokemon_id where dp.draft_session_id = v_session.id and dp.member_id = v_offer.proposer_member_id;
  select coalesce(sum(coalesce(pp.cost, 0)), 0) into v_recipient_spent from draft_picks dp left join draft_pool_pokemon pp
    on pp.pool_id = v_session.pool_id and pp.pokemon_id = dp.pokemon_id where dp.draft_session_id = v_session.id and dp.member_id = v_offer.recipient_member_id;
  if v_rules.points_budget is not null and
    (v_proposer_spent - v_offered_cost + v_requested_cost > v_rules.points_budget or
     v_recipient_spent - v_requested_cost + v_offered_cost > v_rules.points_budget)
    then raise exception 'Der Tausch wuerde ein Punktebudget ueberschreiten.'; end if;
  update draft_picks set member_id = v_offer.recipient_member_id where id = v_offered.id;
  update draft_picks set member_id = v_offer.proposer_member_id where id = v_requested.id;
  update trade_offers set status = 'accepted', resolved_at = now(), updated_at = now() where id = p_offer_id returning * into v_offer;
  return v_offer;
end $$;

revoke all on function make_draft_pick(uuid, text) from public;
revoke all on function undo_last_draft_pick(uuid) from public;
revoke all on function create_trade_offer(uuid, uuid, uuid, uuid, text) from public;
revoke all on function resolve_trade_offer(uuid, text) from public;
grant execute on function make_draft_pick(uuid, text) to authenticated;
grant execute on function undo_last_draft_pick(uuid) to authenticated;
grant execute on function create_trade_offer(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function resolve_trade_offer(uuid, text) to authenticated;
grant select on trade_offers to authenticated;
