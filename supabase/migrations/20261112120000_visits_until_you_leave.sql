-- A visit lasts until the visitor leaves or the owner sees them out
-- (`src/game/harbour/houseVisit.ts`), never for a fixed ten minutes.
--
-- A yes used to let the knocker see the house for ten minutes and no longer,
-- which a player inside had no way to know: the visit stood on the screen and
-- the door to it shut behind them. Now a yes stands while the visitor's
-- browser keeps saying it is still there - every half a minute, held for
-- ninety seconds after the last, as a house is held for an owner at home - so
-- a tab closed mid-visit lets it go within a minute and a half, with nothing
-- to tidy. It ends at once when the visitor walks out ('left') or the owner
-- shows them out ('shown-out'), and the visitor's browser is told which.
-- Whether the owner is still in the harbour at all is the channel's to say
-- (`harbourLink.ts`), not this table's: the database holds only the consent.
--
-- Additive: two columns on `house_knocks`, three new functions, and three
-- written again with the same arguments. No row anywhere is changed or removed;
-- a yes from before this ran keeps its old ten minutes and then lapses.

alter table public.house_knocks
  -- While a yes stands, until when the visitor was last heard in the house.
  add column visit_until timestamptz,
  -- How a visit ended, once it has: walked out of, or the visitor shown out.
  add column visit_ended text check (visit_ended in ('left', 'shown-out'));

create index house_knocks_visits on public.house_knocks (owner_uid, knocker_uid)
  where answer = 'in' and visit_ended is null;

-- The owner's answer to one knock at their own door. A yes starts the visit's
-- ninety seconds, which the visitor's browser keeps topping up.
create or replace function private.answer_knock(knock_id uuid, let_in boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  update public.house_knocks k
  set answer = case when answer_knock.let_in then 'in' else 'not-now' end,
      answered_at = now(),
      visit_until = case when answer_knock.let_in then now() + interval '90 seconds' else null end
  where k.id = answer_knock.knock_id
    and k.owner_uid = (select auth.uid())
    and k.answer is null
    and k.knocked_at > now() - interval '1 minute';
  if not found then
    raise exception 'Nobody is knocking.' using errcode = '22023';
  end if;
  return case when answer_knock.let_in then 'in' else 'not-now' end;
end;
$$;

-- Whether this knock's yes still stands: not walked out of or shown out, and
-- the visitor heard from in the last ninety seconds. A yes from before visits
-- were held this way stands for its old ten minutes.
create function private.visit_stands(k public.house_knocks)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select k.answer = 'in'
    and k.visit_ended is null
    and coalesce(k.visit_until, k.answered_at + interval '10 minutes') > now();
$$;

revoke execute on function private.visit_stands(public.house_knocks) from public, anon, authenticated;

-- A house to look round, for somebody who was let in: the owner's name and
-- the snapshot their browser saved, only while the visit stands.
create or replace function private.visit_house(owner uuid)
returns table (name text, snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select h.name, h.snapshot
  from public.player_houses h
  where h.player_uid = visit_house.owner
    and private.house_is_open(visit_house.owner)
    and exists (
      select 1 from public.house_knocks k
      where k.owner_uid = visit_house.owner
        and k.knocker_uid = (select auth.uid())
        and private.visit_stands(k)
    );
$$;

-- The visitor's browser, still in the house: 'in' (and the visit held for
-- another ninety seconds), 'shown-out' if the owner saw them out, or 'over'
-- for anything else - walked out of, run out, or never let in.
create function private.still_visiting(owner uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  latest public.house_knocks%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  select * into latest from public.house_knocks k
  where k.owner_uid = still_visiting.owner and k.knocker_uid = caller and k.answer = 'in'
  order by k.answered_at desc
  limit 1;
  if not found then
    return 'over';
  end if;
  if latest.visit_ended = 'shown-out' then
    return 'shown-out';
  end if;
  if not private.visit_stands(latest) or not private.house_is_open(still_visiting.owner) then
    return 'over';
  end if;
  update public.house_knocks k set visit_until = now() + interval '90 seconds' where k.id = latest.id;
  return 'in';
end;
$$;

revoke execute on function private.still_visiting(uuid) from public, anon;
grant execute on function private.still_visiting(uuid) to authenticated;

-- The visitor walking out of the owner's house: their visit is over.
create function private.leave_house(owner uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  update public.house_knocks k
  set visit_ended = 'left'
  where k.owner_uid = leave_house.owner
    and k.knocker_uid = (select auth.uid())
    and k.answer = 'in'
    and k.visit_ended is null;
  return 'left';
end;
$$;

revoke execute on function private.leave_house(uuid) from public, anon;
grant execute on function private.leave_house(uuid) to authenticated;

-- The owner seeing one visitor out of their own house: 'shown-out', or
-- 'not-visiting' if that player has no visit standing here.
create function private.show_out(visitor uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  update public.house_knocks k
  set visit_ended = 'shown-out'
  where k.owner_uid = (select auth.uid())
    and k.knocker_uid = show_out.visitor
    and private.visit_stands(k);
  return case when found then 'shown-out' else 'not-visiting' end;
end;
$$;

revoke execute on function private.show_out(uuid) from public, anon;
grant execute on function private.show_out(uuid) to authenticated;

-- The API's entry points: invokers, carrying only the caller's own rights.
create function public.still_visiting(owner uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.still_visiting(owner);
$$;

create function public.leave_house(owner uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.leave_house(owner);
$$;

create function public.show_out(visitor uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.show_out(visitor);
$$;

revoke execute on function public.still_visiting(uuid) from public, anon;
revoke execute on function public.leave_house(uuid) from public, anon;
revoke execute on function public.show_out(uuid) from public, anon;
grant execute on function public.still_visiting(uuid) to authenticated;
grant execute on function public.leave_house(uuid) to authenticated;
grant execute on function public.show_out(uuid) to authenticated;
