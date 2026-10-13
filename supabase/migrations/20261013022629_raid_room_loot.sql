-- Loot to whoever steps on it first, in a raid room (the owner's pick on the
-- multiplayer board, 13 Oct; `src/game/raidRoom/roomLoot.ts`).
--
-- Every player in a room lays the same ground on the room's map, from the
-- room's own seed, which the database hands out and nobody chooses. Who picks
-- a piece up is decided here and nowhere else: the first claim on a piece in a
-- room is the one that holds, under a lock, so two players stepping on it at
-- once never both carry it out. A player may claim only in a room they are in,
-- a piece id the game writes, at most a hundred and twenty in a minute and five
-- hundred in a room. Nothing personal is kept: a claim is a room, a piece id,
-- an anonymous player id and a time.
--
-- Additive throughout: one new column with a default, one new table, new
-- functions. No row anywhere is changed or removed.

alter table public.raid_rooms
  add column seed integer not null default floor(random() * 2147483647)::integer;

create table public.raid_room_loot (
  room_id uuid not null references public.raid_rooms (id) on delete cascade,
  loot_id text not null check (loot_id ~ '^[A-Za-z0-9:_-]{1,80}$'),
  taker_uid uuid not null references auth.users (id) on delete cascade,
  taken_at timestamptz not null default now(),
  primary key (room_id, loot_id)
);

create index raid_room_loot_taker on public.raid_room_loot (taker_uid, taken_at);

alter table public.raid_room_loot enable row level security;

create policy "admins read raid room loot" on public.raid_room_loot
  for select to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

revoke all on public.raid_room_loot from anon, authenticated;
grant select on public.raid_room_loot to authenticated;

-- The open room with this code that the caller is in, if any.
create function private.my_open_raid_room(room_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.id
  from public.raid_rooms r
  join public.raid_room_members m on m.room_id = r.id
  where r.code = upper(btrim(coalesce(my_open_raid_room.room_code, '')))
    and r.closed_at is null
    and r.expires_at > now()
    and m.player_uid = (select auth.uid())
    and m.left_at is null;
$$;

revoke execute on function private.my_open_raid_room(text) from public, anon, authenticated;

-- The room's seed, for the players in it.
create function private.raid_room_seed(room_code text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  room uuid := private.my_open_raid_room(raid_room_seed.room_code);
begin
  if room is null then
    raise exception 'You are not in that room.' using errcode = '42501';
  end if;
  return (select r.seed from public.raid_rooms r where r.id = room);
end;
$$;

revoke execute on function private.raid_room_seed(text) from public, anon;
grant execute on function private.raid_room_seed(text) to authenticated;

-- A claim on one piece: 'yours' if nobody had it, else 'taken' and who has.
create function private.take_raid_loot(room_code text, loot_id text)
returns table (outcome text, taker_uid uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  room uuid;
  holder uuid;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  room := private.my_open_raid_room(take_raid_loot.room_code);
  if room is null then
    raise exception 'You are not in that room.' using errcode = '42501';
  end if;
  if take_raid_loot.loot_id is null or take_raid_loot.loot_id !~ '^[A-Za-z0-9:_-]{1,80}$' then
    raise exception 'That is not a piece of loot.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('raid_room_loot:' || room::text, 0));
  select l.taker_uid into holder from public.raid_room_loot l
  where l.room_id = room and l.loot_id = take_raid_loot.loot_id;
  if found then
    return query select case when holder = caller then 'yours' else 'taken' end, holder;
    return;
  end if;
  if (select count(*) from public.raid_room_loot l where l.taker_uid = caller and l.taken_at > now() - interval '1 minute') >= 120 then
    raise exception 'Slow down.' using errcode = '54000';
  end if;
  if (select count(*) from public.raid_room_loot l where l.room_id = room) >= 500 then
    raise exception 'This room has had all its loot.' using errcode = '54000';
  end if;
  insert into public.raid_room_loot (room_id, loot_id, taker_uid) values (room, take_raid_loot.loot_id, caller);
  return query select 'yours'::text, caller;
end;
$$;

revoke execute on function private.take_raid_loot(text, text) from public, anon;
grant execute on function private.take_raid_loot(text, text) to authenticated;

-- Every piece already taken in the caller's room, for a player dropping in late.
create function private.raid_loot_taken(room_code text)
returns table (loot_id text, taker_uid uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  room uuid := private.my_open_raid_room(raid_loot_taken.room_code);
begin
  if room is null then
    raise exception 'You are not in that room.' using errcode = '42501';
  end if;
  return query select l.loot_id, l.taker_uid from public.raid_room_loot l where l.room_id = room limit 500;
end;
$$;

revoke execute on function private.raid_loot_taken(text) from public, anon;
grant execute on function private.raid_loot_taken(text) to authenticated;

create function public.raid_room_seed(room_code text)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select private.raid_room_seed(room_code);
$$;

create function public.take_raid_loot(room_code text, loot_id text)
returns table (outcome text, taker_uid uuid)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.take_raid_loot(room_code, loot_id);
$$;

create function public.raid_loot_taken(room_code text)
returns table (loot_id text, taker_uid uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.raid_loot_taken(room_code);
$$;

revoke execute on function public.raid_room_seed(text) from public, anon;
revoke execute on function public.take_raid_loot(text, text) from public, anon;
revoke execute on function public.raid_loot_taken(text) from public, anon;
grant execute on function public.raid_room_seed(text) to authenticated;
grant execute on function public.take_raid_loot(text, text) to authenticated;
grant execute on function public.raid_loot_taken(text) to authenticated;
