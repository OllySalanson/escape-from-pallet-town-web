-- Raiding with a friend (`src/game/raidRoom/`): one player makes a room and is
-- handed a short code, a friend types it, and the two drop into the same map
-- and see each other walk.
--
-- What matters is decided here, as the signed-in player: who made a room,
-- which map it is on, who is in it, and who may speak or listen on its
-- Realtime channel (`raid:<code>`). Nothing else about a raid is shared yet -
-- each player keeps their own team, fights, clock and loot in their own
-- browser - so where a figure stands is only ever drawn, never believed, and a
-- name over a figure is the one on that player's door (`harbour_names`), never
-- one a message carries. Nothing personal is kept: a room is a code, a map id
-- and the anonymous ids of the two players in it.
--
-- A code is four consonants (no vowel, so no code spells a word), handed out
-- only among open rooms; a room is open for an hour, and closed once nobody is
-- left in it. A player makes at most twenty rooms a day and one in five
-- seconds, and tries at most thirty codes a day and one a second, so a code
-- cannot be guessed at a script's pace; the whole game makes at most three
-- thousand rooms a day. Every count is taken under a lock, as every other
-- write in this project is.
--
-- Additive throughout: three new tables, new functions, two policies on
-- Realtime's own message table. No row anywhere is changed or removed.

create table public.raid_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[BCDFGHJKLMNPQRSTVWXZ]{4}$'),
  -- A map id as the game writes one (`WorldMapId`); the game checks it is a map
  -- it knows before deploying to it.
  map_id text not null check (map_id ~ '^[a-z0-9-]{1,48}$'),
  host_uid uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  closed_at timestamptz
);

-- A code belongs to one open room at a time; a closed room gives its code back.
create unique index raid_rooms_open_code on public.raid_rooms (code) where closed_at is null;
create index raid_rooms_host on public.raid_rooms (host_uid, created_at desc);
create index raid_rooms_created on public.raid_rooms (created_at);

-- Who is in a room. A player who leaves keeps their row, marked, so the room
-- knows when it is empty.
create table public.raid_room_members (
  room_id uuid not null references public.raid_rooms (id) on delete cascade,
  player_uid uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, player_uid)
);

create index raid_room_members_player on public.raid_room_members (player_uid);

-- How many codes a player has tried today: one row a player, started again
-- each day, so it never grows past the number of players.
create table public.raid_room_tries (
  player_uid uuid primary key references auth.users (id) on delete cascade,
  since timestamptz not null default now(),
  tries integer not null default 0,
  last_try_at timestamptz not null default now()
);

alter table public.raid_rooms enable row level security;
alter table public.raid_room_members enable row level security;
alter table public.raid_room_tries enable row level security;

create policy "admins read raid rooms" on public.raid_rooms
  for select to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
create policy "admins read raid room members" on public.raid_room_members
  for select to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
create policy "admins read raid room tries" on public.raid_room_tries
  for select to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

revoke all on public.raid_rooms, public.raid_room_members, public.raid_room_tries from anon, authenticated;
grant select on public.raid_rooms, public.raid_room_members, public.raid_room_tries to authenticated;

-- Closes every room whose hour is up, and every open room nobody is left in.
create function private.close_empty_raid_rooms()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.raid_rooms r
  set closed_at = now()
  where r.closed_at is null
    and (
      r.expires_at <= now()
      or not exists (
        select 1 from public.raid_room_members m where m.room_id = r.id and m.left_at is null
      )
    );
$$;

revoke execute on function private.close_empty_raid_rooms() from public, anon, authenticated;

-- A new room on this map, made by the caller, and its code. Making one takes
-- the caller out of any other room they were in.
create function private.open_raid_room(map_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  alphabet constant text := 'BCDFGHJKLMNPQRSTVWXZ';
  made text;
  room uuid;
  attempt integer := 0;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('raid_rooms', 0));
  if not private.house_is_open(caller) then
    raise exception 'Name your house first.' using errcode = '42501';
  end if;
  if open_raid_room.map_id is null or open_raid_room.map_id !~ '^[a-z0-9-]{1,48}$' then
    raise exception 'That is not a map.' using errcode = '22023';
  end if;
  if exists (select 1 from public.raid_rooms r where r.host_uid = caller and r.created_at > now() - interval '5 seconds') then
    raise exception 'One room at a time.' using errcode = '54000';
  end if;
  if (select count(*) from public.raid_rooms r where r.host_uid = caller and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Twenty rooms a day. Try again tomorrow.' using errcode = '54000';
  end if;
  if (select count(*) from public.raid_rooms r where r.created_at > now() - interval '1 day') >= 3000 then
    raise exception 'Every room is taken for today. Try again tomorrow.' using errcode = '54000';
  end if;

  update public.raid_room_members m
  set left_at = now()
  where m.player_uid = caller and m.left_at is null;
  perform private.close_empty_raid_rooms();

  loop
    attempt := attempt + 1;
    if attempt > 40 then
      raise exception 'Every room is taken for now. Try again in a minute.' using errcode = '54000';
    end if;
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1), '')
      into made
      from generate_series(1, 4);
    exit when not exists (select 1 from public.raid_rooms r where r.code = made and r.closed_at is null);
  end loop;

  insert into public.raid_rooms (code, map_id, host_uid)
  values (made, open_raid_room.map_id, caller)
  returning id into room;
  insert into public.raid_room_members (room_id, player_uid) values (room, caller);
  return made;
end;
$$;

revoke execute on function private.open_raid_room(text) from public, anon;
grant execute on function private.open_raid_room(text) to authenticated;

-- The caller, into the open room with this code: 'joined' with its map and
-- who made it, 'no-room' for a code no open room has, or 'full'. Every call is
-- a try, counted, and a wrong code is an answer rather than an error so the
-- count is kept.
create function private.join_raid_room(room_code text)
returns table (outcome text, map_id text, host_uid uuid, host_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  wanted text := upper(btrim(coalesce(join_raid_room.room_code, '')));
  mine public.raid_room_tries%rowtype;
  found_room public.raid_rooms%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('raid_rooms', 0));
  if not private.house_is_open(caller) then
    raise exception 'Name your house first.' using errcode = '42501';
  end if;

  insert into public.raid_room_tries (player_uid, since, tries, last_try_at)
  values (caller, now(), 0, now() - interval '1 day')
  on conflict (player_uid) do nothing;
  select * into mine from public.raid_room_tries t where t.player_uid = caller;
  if mine.since <= now() - interval '1 day' then
    mine.tries := 0;
    mine.since := now();
  end if;
  if mine.last_try_at > now() - interval '1 second' then
    raise exception 'One code at a time.' using errcode = '54000';
  end if;
  if mine.tries >= 30 then
    raise exception 'Thirty codes a day. Try again tomorrow.' using errcode = '54000';
  end if;
  update public.raid_room_tries t
  set tries = mine.tries + 1, since = mine.since, last_try_at = now()
  where t.player_uid = caller;

  perform private.close_empty_raid_rooms();
  if wanted !~ '^[BCDFGHJKLMNPQRSTVWXZ]{4}$' then
    return query select 'no-room'::text, null::text, null::uuid, null::text;
    return;
  end if;
  select * into found_room from public.raid_rooms r
  where r.code = wanted and r.closed_at is null and r.expires_at > now();
  if not found or not private.house_is_open(found_room.host_uid) then
    return query select 'no-room'::text, null::text, null::uuid, null::text;
    return;
  end if;
  if not exists (
    select 1 from public.raid_room_members m
    where m.room_id = found_room.id and m.player_uid = caller and m.left_at is null
  ) then
    if (select count(*) from public.raid_room_members m where m.room_id = found_room.id and m.left_at is null) >= 2 then
      return query select 'full'::text, null::text, null::uuid, null::text;
      return;
    end if;
    -- In one room at a time: joining this one leaves any other.
    update public.raid_room_members m
    set left_at = now()
    where m.player_uid = caller and m.left_at is null;
    insert into public.raid_room_members (room_id, player_uid)
    values (found_room.id, caller)
    on conflict (room_id, player_uid) do update set left_at = null, joined_at = now();
    perform private.close_empty_raid_rooms();
  end if;
  return query
    select 'joined'::text, found_room.map_id, found_room.host_uid, h.name
    from public.player_houses h
    where h.player_uid = found_room.host_uid;
end;
$$;

revoke execute on function private.join_raid_room(text) from public, anon;
grant execute on function private.join_raid_room(text) to authenticated;

-- The caller, out of the room with this code. A room nobody is left in closes.
create function private.leave_raid_room(room_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('raid_rooms', 0));
  update public.raid_room_members m
  set left_at = now()
  from public.raid_rooms r
  where m.room_id = r.id
    and r.code = upper(btrim(coalesce(leave_raid_room.room_code, '')))
    and r.closed_at is null
    and m.player_uid = caller
    and m.left_at is null;
  perform private.close_empty_raid_rooms();
  return 'left';
end;
$$;

revoke execute on function private.leave_raid_room(text) from public, anon;
grant execute on function private.leave_raid_room(text) to authenticated;

-- Whether the caller may be on this room's channel: in the room, the room
-- open, and their house neither hidden nor blocked. Asked by the channel's
-- policies below, as the caller, when they join.
create function private.may_walk_raid_room(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.house_is_open((select auth.uid()))
    and exists (
      select 1
      from public.raid_rooms r
      join public.raid_room_members m on m.room_id = r.id
      where may_walk_raid_room.topic = 'raid:' || r.code
        and r.closed_at is null
        and r.expires_at > now()
        and m.player_uid = (select auth.uid())
        and m.left_at is null
    );
$$;

revoke execute on function private.may_walk_raid_room(text) from public, anon;
grant execute on function private.may_walk_raid_room(text) to authenticated;

-- The API's entry points: invokers, carrying only the caller's own rights.
create function public.open_raid_room(map_id text)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.open_raid_room(map_id);
$$;

create function public.join_raid_room(room_code text)
returns table (outcome text, map_id text, host_uid uuid, host_name text)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.join_raid_room(room_code);
$$;

create function public.leave_raid_room(room_code text)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.leave_raid_room(room_code);
$$;

revoke execute on function public.open_raid_room(text) from public, anon;
revoke execute on function public.join_raid_room(text) from public, anon;
revoke execute on function public.leave_raid_room(text) from public, anon;
grant execute on function public.open_raid_room(text) to authenticated;
grant execute on function public.join_raid_room(text) to authenticated;
grant execute on function public.leave_raid_room(text) to authenticated;

-- A room's Realtime channel (`raid:<code>`, private): only the players in the
-- room may listen or be heard - walk about (broadcast) or say they are there
-- (presence). Realtime asks these once, as the player joins; it stores no
-- message.
create policy "room members watch their raid" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) like 'raid:%'
    and realtime.messages.extension in ('broadcast', 'presence')
    and (select private.may_walk_raid_room((select realtime.topic())))
  );
create policy "room members walk their raid" on realtime.messages
  for insert to authenticated
  with check (
    (select realtime.topic()) like 'raid:%'
    and realtime.messages.extension in ('broadcast', 'presence')
    and (select private.may_walk_raid_room((select realtime.topic())))
  );
