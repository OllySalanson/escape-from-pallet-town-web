-- The shared harbour: everybody who plays walks the same HARBOUR, and sees
-- everybody else there by the name they gave at their own front door.
--
-- Two halves. What matters is held here and nowhere else: who has a house and
-- what it is called - a name the console's own rule and word filter allow,
-- written only by `name_my_house` as the caller, at most a few times a day -
-- and who may walk the harbour channel at all. What does not matter is left to
-- the players' browsers: where a figure stands is only ever drawn, never
-- believed, and a name is never taken from a message - every browser asks
-- `harbour_names` for the names of the ids it sees (`src/game/harbour/`).
--
-- Additive throughout: one new table, new functions, policies on Realtime's
-- own message table. No row anywhere is changed or removed.

-- A player's house, and the name on its door. One per player.
create table public.player_houses (
  player_uid uuid primary key references auth.users (id) on delete cascade,
  -- The console's name rule (`console/playerName.ts`), as `console_scores` holds it.
  name text not null check (name ~ '^[A-Z0-9.!?''-]([A-Z0-9 .!?''-]{0,8}[A-Z0-9.!?''-])?$' and name !~ '  '),
  created_at timestamptz not null default now(),
  -- When the name last changed, and how often it has today: a house is
  -- renamed at the console's pace, never at a script's.
  named_at timestamptz not null default now(),
  names_today integer not null default 1,
  -- Set by an admin to take a house out of the harbour without losing the row.
  hidden boolean not null default false
);

create index player_houses_created on public.player_houses (created_at);

alter table public.player_houses enable row level security;

create policy "admins read player houses" on public.player_houses
  for select to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
create policy "admins hide player houses" on public.player_houses
  for update to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

revoke all on public.player_houses from anon, authenticated;
grant select on public.player_houses to authenticated;
grant update (hidden) on public.player_houses to authenticated;

-- The caller's house, under this name: made the first time, renamed after.
-- The name is the console's (same pattern, same word filter); a player renames
-- at most ten times a day and not twice in ten seconds, and the harbour takes
-- at most two thousand new houses a day, counted exactly under a lock as every
-- other write in this project is.
create function private.name_my_house(player_name text)
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
    raise exception 'Sign in before naming a house.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('name_my_house', 0));
  if exists (select 1 from public.blocked_makers where maker_uid = caller) then
    raise exception 'This player cannot have a house.' using errcode = '42501';
  end if;
  if name_my_house.player_name is null
     or name_my_house.player_name !~ '^[A-Z0-9.!?''-]([A-Z0-9 .!?''-]{0,8}[A-Z0-9.!?''-])?$'
     or name_my_house.player_name ~ '  ' then
    raise exception 'A name is capitals, digits and . ! ? '' -, at most ten.' using errcode = '22023';
  end if;
  if not private.console_name_is_clean(name_my_house.player_name) then
    raise exception 'Pick another name.' using errcode = '22023';
  end if;

  select * into mine from public.player_houses h where h.player_uid = caller;
  if not found then
    if (select count(*) from public.player_houses h where h.created_at > now() - interval '1 day') >= 2000 then
      raise exception 'The harbour is full for today. Try again tomorrow.' using errcode = '54000';
    end if;
    insert into public.player_houses (player_uid, name) values (caller, name_my_house.player_name);
    return 'named';
  end if;
  if mine.name = name_my_house.player_name then
    return 'unchanged';
  end if;
  if mine.named_at > now() - interval '10 seconds' then
    raise exception 'One name at a time.' using errcode = '54000';
  end if;
  if mine.named_at > now() - interval '1 day' and mine.names_today >= 10 then
    raise exception 'Ten names a day. Try again tomorrow.' using errcode = '54000';
  end if;
  update public.player_houses h
  set name = name_my_house.player_name,
      names_today = case when h.named_at > now() - interval '1 day' then h.names_today + 1 else 1 end,
      named_at = now()
  where h.player_uid = caller;
  return 'renamed';
end;
$$;

revoke execute on function private.name_my_house(text) from public, anon;
grant execute on function private.name_my_house(text) to authenticated;

-- The names on the doors of the players a browser can see in the harbour, by
-- their ids: at most sixty-four at a time, and nobody hidden or blocked. Read
-- signed out too, because looking at the harbour signs nobody up (F10's rule
-- for the boards); a name is on show to everybody who plays by design.
create function private.harbour_names(player_uids uuid[])
returns table (player_uid uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if harbour_names.player_uids is null or cardinality(harbour_names.player_uids) > 64 then
    raise exception 'At most sixty-four names at a time.' using errcode = '22023';
  end if;
  return query
    select h.player_uid, h.name
    from public.player_houses h
    where h.player_uid = any (harbour_names.player_uids)
      and not h.hidden
      and not exists (select 1 from public.blocked_makers b where b.maker_uid = h.player_uid);
end;
$$;

revoke execute on function private.harbour_names(uuid[]) from public, anon;
grant execute on function private.harbour_names(uuid[]) to anon, authenticated;

-- Whether the caller may be seen in the harbour: signed in, a house named, and
-- neither hidden nor blocked. Asked by the channel's policy below, as the
-- caller, when they join.
create function private.may_walk_the_harbour()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.player_houses h
    where h.player_uid = (select auth.uid())
      and not h.hidden
      and not exists (select 1 from public.blocked_makers b where b.maker_uid = h.player_uid)
  );
$$;

revoke execute on function private.may_walk_the_harbour() from public, anon;
grant execute on function private.may_walk_the_harbour() to authenticated;

-- The API's entry points: invokers, carrying only the caller's own rights.
create function public.name_my_house(player_name text)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.name_my_house(player_name);
$$;

create function public.harbour_names(player_uids uuid[])
returns table (player_uid uuid, name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.harbour_names(player_uids);
$$;

revoke execute on function public.name_my_house(text) from public, anon;
revoke execute on function public.harbour_names(uuid[]) from public, anon;
grant execute on function public.name_my_house(text) to authenticated;
grant execute on function public.harbour_names(uuid[]) to anon, authenticated;

-- The harbour's Realtime channel (`harbour`, private). Anybody may listen -
-- looking signs nobody up - and only a player with a named house may be
-- heard: walk about (broadcast) or say they are there (presence). Realtime
-- asks these once, as the player joins; it stores no message.
create policy "anybody may watch the harbour" on realtime.messages
  for select to anon, authenticated
  using ((select realtime.topic()) = 'harbour' and realtime.messages.extension in ('broadcast', 'presence'));
create policy "players with a house walk the harbour" on realtime.messages
  for insert to authenticated
  with check (
    (select realtime.topic()) = 'harbour'
    and realtime.messages.extension in ('broadcast', 'presence')
    and (select private.may_walk_the_harbour())
  );
