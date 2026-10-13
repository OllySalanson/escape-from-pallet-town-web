-- A raid room holds up to four players, not two (the owner's pick on the
-- multiplayer board, 13 Oct): the one who made it and up to three friends.
-- Only the count changes; the function is otherwise the one before it.

create or replace function private.join_raid_room(room_code text)
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
    if (select count(*) from public.raid_room_members m where m.room_id = found_room.id and m.left_at is null) >= 4 then
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
