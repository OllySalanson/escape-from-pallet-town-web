-- Names are one each: chosen when a game starts (`src/game/names/`), checked
-- against everybody else's as they are typed, and held by the anonymous player
-- who chose them, case and all - ASH and Ash are one name.
--
-- The owner's call for the alpha (12 Oct 2026): start names again from
-- nothing. Tonight's names and houses are cleared - the rows of
-- `player_houses` and `house_knocks`, which are test data - and nothing else:
-- saves live in the players' browsers, and the console's scores and the
-- feedback are left exactly as they are.

delete from public.house_knocks;
delete from public.player_houses;

-- The one rule that makes a name a player's own: no two houses share it,
-- whatever its case. `name_my_house` counts under a lock first; this is the
-- floor under that, should two ever reach the insert together.
create unique index player_houses_name_unique on public.player_houses (upper(name));

-- Whether a name could be the caller's: 'free', 'yours' (the caller already
-- has it), 'taken', 'invalid' (not the console's rule) or 'unkind' (the word
-- filter). Asked as a name is typed, signed out too - a name is on show to
-- everybody anyway - so it says nothing that the harbour does not.
create function private.name_is_free(player_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when name_is_free.player_name is null
      or name_is_free.player_name !~ '^[A-Z0-9.!?''-]([A-Z0-9 .!?''-]{0,8}[A-Z0-9.!?''-])?$'
      or name_is_free.player_name ~ '  ' then 'invalid'
    when not private.console_name_is_clean(name_is_free.player_name) then 'unkind'
    when exists (
      select 1 from public.player_houses h
      where upper(h.name) = upper(name_is_free.player_name)
        and h.player_uid = (select auth.uid())
    ) then 'yours'
    when exists (
      select 1 from public.player_houses h where upper(h.name) = upper(name_is_free.player_name)
    ) then 'taken'
    else 'free'
  end;
$$;

revoke execute on function private.name_is_free(text) from public, anon;
grant execute on function private.name_is_free(text) to anon, authenticated;

-- The caller's name, chosen: made the first time, changed after, and refused
-- with 'taken' - an answer, not an error - when anybody else has it. Every
-- other rule is as it was (`shared_harbour`).
create or replace function private.name_my_house(player_name text)
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
  if exists (
    select 1 from public.player_houses h
    where upper(h.name) = upper(name_my_house.player_name) and h.player_uid <> caller
  ) then
    return 'taken';
  end if;

  select * into mine from public.player_houses h where h.player_uid = caller;
  if not found then
    if (select count(*) from public.player_houses h where h.created_at > now() - interval '1 day') >= 2000 then
      raise exception 'The harbour is full for today. Try again tomorrow.' using errcode = '54000';
    end if;
    begin
      insert into public.player_houses (player_uid, name) values (caller, name_my_house.player_name);
    exception when unique_violation then
      return 'taken';
    end;
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
  begin
    update public.player_houses h
    set name = name_my_house.player_name,
        names_today = case when h.named_at > now() - interval '1 day' then h.names_today + 1 else 1 end,
        named_at = now()
    where h.player_uid = caller;
  exception when unique_violation then
    return 'taken';
  end;
  return 'renamed';
end;
$$;

revoke execute on function private.name_my_house(text) from public, anon;
grant execute on function private.name_my_house(text) to authenticated;

-- The API's entry point for the check: an invoker, carrying only the caller's rights.
create function public.name_is_free(player_name text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.name_is_free(player_name);
$$;

revoke execute on function public.name_is_free(text) from public, anon;
grant execute on function public.name_is_free(text) to anon, authenticated;
