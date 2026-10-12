-- Knocking on somebody's door in the shared harbour (`src/game/home/knocking.ts`).
--
-- Everything a knock depends on is decided here, as the signed-in player:
-- whether the house is anybody's, whether its owner is at home, who knocked,
-- whether they were let in, and whether a visitor may see inside. The house a
-- visitor is shown is a snapshot its owner's browser saves - what the house is
-- drawn from and nothing else, size-capped - and the visitor's game reads it
-- back through the same loader any save goes through, so it is drawn, never
-- believed. Nothing a knock does lasts: a knock is good for a minute, a yes for
-- ten.
--
-- Additive throughout: three columns on `player_houses`, one new table, new
-- functions. No row anywhere is changed or removed.

-- What a visitor is shown, and whether the owner is at home: their browser
-- says so every half a minute while they stand in their house, and a house is
-- "home" for ninety seconds after the last time it did.
alter table public.player_houses
  add column snapshot jsonb,
  add column snapshot_at timestamptz,
  add column home_until timestamptz;

-- One knock on one door. Kept a day for the counting, then nobody reads it.
create table public.house_knocks (
  id uuid primary key default gen_random_uuid(),
  knocker_uid uuid not null references auth.users (id) on delete cascade,
  owner_uid uuid not null references auth.users (id) on delete cascade,
  knocked_at timestamptz not null default now(),
  -- 'in' or 'not-now', once the owner has said.
  answer text check (answer in ('in', 'not-now')),
  answered_at timestamptz,
  check (knocker_uid <> owner_uid)
);

create index house_knocks_owner on public.house_knocks (owner_uid, knocked_at desc);
create index house_knocks_knocker on public.house_knocks (knocker_uid, knocked_at desc);
create index house_knocks_knocked on public.house_knocks (knocked_at);

alter table public.house_knocks enable row level security;

create policy "admins read house knocks" on public.house_knocks
  for select to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

revoke all on public.house_knocks from anon, authenticated;
grant select on public.house_knocks to authenticated;

-- Whether a house can be knocked at: named, not hidden, its owner not blocked.
create function private.house_is_open(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.player_houses h
    where h.player_uid = house_is_open.owner
      and not h.hidden
      and not exists (select 1 from public.blocked_makers b where b.maker_uid = h.player_uid)
  );
$$;

revoke execute on function private.house_is_open(uuid) from public, anon, authenticated;

-- The caller standing in their own house, or (false) gone out of it; and what
-- it looks like, when it has changed. A snapshot is at most twelve kilobytes,
-- an object, and saved at most once in ten seconds.
create function private.at_my_house(at_home boolean, snapshot jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  mine public.player_houses%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  select * into mine from public.player_houses h where h.player_uid = caller;
  if not found then
    raise exception 'Name your house first.' using errcode = '42501';
  end if;
  if at_my_house.snapshot is not null then
    if jsonb_typeof(at_my_house.snapshot) <> 'object' or octet_length(at_my_house.snapshot::text) > 12000 then
      raise exception 'That is not a house.' using errcode = '22023';
    end if;
    if mine.snapshot_at is not null and mine.snapshot_at > now() - interval '10 seconds'
       and mine.snapshot is distinct from at_my_house.snapshot then
      raise exception 'One look at a time.' using errcode = '54000';
    end if;
  end if;
  update public.player_houses h
  set home_until = case when at_my_house.at_home then now() + interval '90 seconds' else null end,
      snapshot = coalesce(at_my_house.snapshot, h.snapshot),
      snapshot_at = case when at_my_house.snapshot is not null and h.snapshot is distinct from at_my_house.snapshot then now() else h.snapshot_at end
  where h.player_uid = caller;
  return case when at_my_house.at_home then 'home' else 'out' end;
end;
$$;

revoke execute on function private.at_my_house(boolean, jsonb) from public, anon;
grant execute on function private.at_my_house(boolean, jsonb) to authenticated;

-- Every house in the harbour that can be knocked at, by name, and whether its
-- owner is in: at most two hundred, the caller's own left out.
create function private.harbour_houses()
returns table (player_uid uuid, name text, at_home boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select h.player_uid, h.name, coalesce(h.home_until > now(), false)
  from public.player_houses h
  where h.player_uid <> (select auth.uid())
    and not h.hidden
    and not exists (select 1 from public.blocked_makers b where b.maker_uid = h.player_uid)
  order by coalesce(h.home_until > now(), false) desc, h.name, h.created_at
  limit 200;
$$;

revoke execute on function private.harbour_houses() from public, anon;
grant execute on function private.harbour_houses() to authenticated;

-- A knock on a door: refused if the house is the caller's or nobody's, said
-- to be empty if its owner is out, and otherwise left for them to answer. A
-- player knocks once in five seconds and sixty times a day, a door takes at
-- most three knocks waiting at once, and the whole harbour five thousand a
-- day, counted under a lock.
create function private.knock_on(owner uuid)
returns table (knock_id uuid, outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  made uuid;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('knock_on', 0));
  if not private.house_is_open(caller) then
    raise exception 'Name your house first.' using errcode = '42501';
  end if;
  if knock_on.owner is null or knock_on.owner = caller or not private.house_is_open(knock_on.owner) then
    raise exception 'There is no such house.' using errcode = '22023';
  end if;
  if exists (select 1 from public.house_knocks k where k.knocker_uid = caller and k.knocked_at > now() - interval '5 seconds') then
    raise exception 'One knock at a time.' using errcode = '54000';
  end if;
  if (select count(*) from public.house_knocks k where k.knocker_uid = caller and k.knocked_at > now() - interval '1 day') >= 60 then
    raise exception 'Sixty knocks a day. Try again tomorrow.' using errcode = '54000';
  end if;
  if (select count(*) from public.house_knocks k where k.knocked_at > now() - interval '1 day') >= 5000 then
    raise exception 'The harbour is quiet for today. Try again tomorrow.' using errcode = '54000';
  end if;
  if not exists (select 1 from public.player_houses h where h.player_uid = knock_on.owner and h.home_until > now()) then
    return query select null::uuid, 'not-home'::text;
    return;
  end if;
  if (select count(*) from public.house_knocks k
      where k.owner_uid = knock_on.owner and k.answer is null and k.knocked_at > now() - interval '1 minute') >= 3 then
    return query select null::uuid, 'busy'::text;
    return;
  end if;
  insert into public.house_knocks (knocker_uid, owner_uid) values (caller, knock_on.owner) returning id into made;
  return query select made, 'knocking'::text;
end;
$$;

revoke execute on function private.knock_on(uuid) from public, anon;
grant execute on function private.knock_on(uuid) to authenticated;

-- The knocks waiting at the caller's door: unanswered, under a minute old, by
-- the knocker's name.
create function private.knocks_at_my_door()
returns table (knock_id uuid, knocker_name text, knocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, h.name, k.knocked_at
  from public.house_knocks k
  join public.player_houses h on h.player_uid = k.knocker_uid
  where k.owner_uid = (select auth.uid())
    and k.answer is null
    and k.knocked_at > now() - interval '1 minute'
    and not h.hidden
    and not exists (select 1 from public.blocked_makers b where b.maker_uid = k.knocker_uid)
  order by k.knocked_at
  limit 3;
$$;

revoke execute on function private.knocks_at_my_door() from public, anon;
grant execute on function private.knocks_at_my_door() to authenticated;

-- The owner's answer to one knock at their own door.
create function private.answer_knock(knock_id uuid, let_in boolean)
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
      answered_at = now()
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

revoke execute on function private.answer_knock(uuid, boolean) from public, anon;
grant execute on function private.answer_knock(uuid, boolean) to authenticated;

-- How the caller's own knock stands: 'waiting', 'in', 'not-now', or 'gone'
-- once a minute has passed with no answer.
create function private.my_knock(knock_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
              when k.answer is not null then k.answer
              when k.knocked_at > now() - interval '1 minute' then 'waiting'
              else 'gone'
            end
     from public.house_knocks k
     where k.id = my_knock.knock_id and k.knocker_uid = (select auth.uid())),
    'gone'
  );
$$;

revoke execute on function private.my_knock(uuid) from public, anon;
grant execute on function private.my_knock(uuid) to authenticated;

-- A house to look round, for somebody who was let in: the owner's name and
-- the snapshot their browser saved, only while a yes from the last ten
-- minutes stands.
create function private.visit_house(owner uuid)
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
        and k.answer = 'in'
        and k.answered_at > now() - interval '10 minutes'
    );
$$;

revoke execute on function private.visit_house(uuid) from public, anon;
grant execute on function private.visit_house(uuid) to authenticated;

-- The API's entry points: invokers, carrying only the caller's own rights.
create function public.at_my_house(at_home boolean, snapshot jsonb)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.at_my_house(at_home, snapshot);
$$;

create function public.harbour_houses()
returns table (player_uid uuid, name text, at_home boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.harbour_houses();
$$;

create function public.knock_on(owner uuid)
returns table (knock_id uuid, outcome text)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.knock_on(owner);
$$;

create function public.knocks_at_my_door()
returns table (knock_id uuid, knocker_name text, knocked_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.knocks_at_my_door();
$$;

create function public.answer_knock(knock_id uuid, let_in boolean)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.answer_knock(knock_id, let_in);
$$;

create function public.my_knock(knock_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.my_knock(knock_id);
$$;

create function public.visit_house(owner uuid)
returns table (name text, snapshot jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.visit_house(owner);
$$;

revoke execute on function public.at_my_house(boolean, jsonb) from public, anon;
revoke execute on function public.harbour_houses() from public, anon;
revoke execute on function public.knock_on(uuid) from public, anon;
revoke execute on function public.knocks_at_my_door() from public, anon;
revoke execute on function public.answer_knock(uuid, boolean) from public, anon;
revoke execute on function public.my_knock(uuid) from public, anon;
revoke execute on function public.visit_house(uuid) from public, anon;
grant execute on function public.at_my_house(boolean, jsonb) to authenticated;
grant execute on function public.harbour_houses() to authenticated;
grant execute on function public.knock_on(uuid) to authenticated;
grant execute on function public.knocks_at_my_door() to authenticated;
grant execute on function public.answer_knock(uuid, boolean) to authenticated;
grant execute on function public.my_knock(uuid) to authenticated;
grant execute on function public.visit_house(uuid) to authenticated;
