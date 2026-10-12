-- Counting play: does anyone actually play this game? (`src/game/analytics/`).
--
-- No account, no cookie, nothing personal. A browser keeps a random id of its
-- own (one per browser, never tied to a sign-in) and sends a few counted
-- moments - the game opened, a starter chosen, a raid started and how it
-- ended, minutes played, a map sent in, a Pallet Blocks game, a walk into the
-- harbour - with the build it is running. No address, name, IP or free text
-- is ever stored: every field is a word from a short list or a number.
--
-- It is sent signed out (`record_play`, open to the publishable key alone),
-- so counting a visitor never makes an anonymous user of them and never asks
-- the bot check. That makes the checks here the only ones: the whole batch is
-- refused on any field that is not one this game sends, a batch is small, and
-- a browser id and everybody together are each held to a daily count, counted
-- exactly on the row they bump.
--
-- Nothing raw is kept at all. A moment is added to its day's totals the
-- instant it arrives (`play_daily`, one row per day per thing counted), and
-- the only row about a browser is its id with the first and last day it was
-- seen, how many days that was and how many moments it sent today - which is
-- everything "players today, this week, returning" needs. So the tables stay
-- a few rows a day however many play, and there is nothing to prune. Only an
-- admin reads any of it (`play_stats`); no table is reachable from the API.

create table private.play_visitors (
  visitor uuid primary key,
  first_day date not null,
  last_day date not null,
  -- The day it was last seen before this one: what tells a batch whether it
  -- is this browser's first today, read back off the row its upsert locked.
  previous_day date,
  days_seen integer not null default 1,
  events_today integer not null default 0
);

create table private.play_daily (
  day date not null,
  metric text not null,
  detail text not null default '',
  count bigint not null default 0,
  primary key (day, metric, detail)
);

create index play_visitors_last_day on private.play_visitors (last_day);

alter table private.play_visitors enable row level security;
alter table private.play_daily enable row level security;
revoke all on private.play_visitors, private.play_daily from public, anon, authenticated;

-- One batch of counted moments from one browser. Returns how many were counted.
-- The limits: fifty moments a batch in eight kilobytes, six hundred a day from
-- one browser id and a hundred thousand a day from everybody.
create function private.record_play(visitor_id uuid, build text, events jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/London')::date;
  n integer;
  item jsonb;
  moment_kind text;
  moment_detail text;
  moment_amount integer;
  mine integer;
  before date;
  everybody bigint;
begin
  if visitor_id is null then
    raise exception 'A visitor is needed.' using errcode = '22023';
  end if;
  if record_play.build is null or record_play.build !~ '^[A-Za-z0-9._-]{1,40}$' then
    raise exception 'That is not a build.' using errcode = '22023';
  end if;
  if jsonb_typeof(events) is distinct from 'array'
     or octet_length(events::text) > 8000
     or jsonb_array_length(events) not between 1 and 50 then
    raise exception 'A batch is one to fifty moments.' using errcode = '22023';
  end if;
  n := jsonb_array_length(events);

  -- Every moment is checked before anything is written: one that is not a
  -- moment this game sends refuses the whole batch.
  for item in select value from jsonb_array_elements(events) loop
    if jsonb_typeof(item) is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(item) as k(key) where k.key not in ('kind', 'detail', 'amount'))
       or jsonb_typeof(item -> 'kind') is distinct from 'string'
       or (item ? 'detail' and jsonb_typeof(item -> 'detail') is distinct from 'string')
       or (item ? 'amount' and jsonb_typeof(item -> 'amount') is distinct from 'number') then
      raise exception 'That is not a moment.' using errcode = '22023';
    end if;
    moment_kind := item ->> 'kind';
    moment_detail := coalesce(item ->> 'detail', '');
    if item ? 'amount' and (item -> 'amount')::numeric not between 0 and 3600 then
      raise exception 'That is not an amount.' using errcode = '22023';
    end if;
    moment_amount := coalesce((item -> 'amount')::numeric, 0)::integer;
    if not (
      (moment_kind in ('visit', 'map-sent', 'harbour') and moment_detail = '' and moment_amount = 0)
      or (moment_kind = 'starter' and moment_detail in ('bulbasaur', 'charmander', 'squirtle') and moment_amount = 0)
      or (moment_kind = 'raid-start' and moment_detail ~ '^[a-z0-9-]{1,40}$' and moment_amount = 0)
      or (moment_kind = 'raid-end' and moment_detail in ('extracted', 'wiped', 'clock', 'abandoned') and moment_amount = 0)
      or (moment_kind = 'played' and moment_detail = '' and moment_amount between 1 and 3600)
      or (moment_kind = 'blocks' and exists (select 1 from private.console_games g where g.id = moment_detail) and moment_amount = 0)
    ) then
      raise exception 'That is not a moment this game counts.' using errcode = '22023';
    end if;
  end loop;

  -- The limits, counted on the rows they bump, so two batches at once count
  -- one after the other. A refusal rolls every count back with it.
  insert into private.play_visitors as v (visitor, first_day, last_day, previous_day, days_seen, events_today)
  values (visitor_id, today, today, null, 1, n)
  on conflict (visitor) do update set
    previous_day = v.last_day,
    days_seen = v.days_seen + case when v.last_day < today then 1 else 0 end,
    events_today = case when v.last_day < today then excluded.events_today else v.events_today + excluded.events_today end,
    last_day = today
  returning v.events_today, v.previous_day into mine, before;
  if mine > 600 then
    raise exception 'Enough for today from this browser.' using errcode = '54000';
  end if;
  insert into private.play_daily as t (day, metric, detail, count)
  values (today, 'events', '', n)
  on conflict (day, metric, detail) do update set count = t.count + excluded.count
  returning t.count into everybody;
  if everybody > 100000 then
    raise exception 'Enough for today.' using errcode = '54000';
  end if;

  -- Who: a player today, and new or returning.
  if before is null or before < today then
    insert into private.play_daily as t (day, metric, detail, count)
    values (today, 'players', '', 1), (today, case when before is null then 'new-players' else 'returning-players' end, '', 1)
    on conflict (day, metric, detail) do update set count = t.count + excluded.count;
  end if;

  -- What: each moment counted into the day, and which build a session ran.
  insert into private.play_daily as t (day, metric, detail, count)
  select today, m.metric, m.detail, sum(m.count)
  from (
    select case when e.value ->> 'kind' = 'played' then 'played-seconds' else e.value ->> 'kind' end as metric,
           coalesce(e.value ->> 'detail', '') as detail,
           case when e.value ->> 'kind' = 'played' then (e.value -> 'amount')::numeric::integer else 1 end as count
    from jsonb_array_elements(events) as e(value)
    union all
    select 'build', record_play.build, 1
    from jsonb_array_elements(events) as e(value)
    where e.value ->> 'kind' = 'visit'
  ) as m
  group by m.metric, m.detail
  on conflict (day, metric, detail) do update set count = t.count + excluded.count;

  return n;
end;
$$;

-- The owner's page: everything the STATS screen shows, in one answer.
create function private.play_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/London')::date;
begin
  if not (select private.is_admin())
     or ((select auth.jwt()) ->> 'is_anonymous')::boolean is true then
    raise exception 'Only the owner reads the play counts.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'today', today,
    'playersToday', (select count(*) from private.play_visitors v where v.last_day = today),
    'playersWeek', (select count(*) from private.play_visitors v where v.last_day > today - 7),
    'playersAllTime', (select count(*) from private.play_visitors),
    'returningWeek', (select count(*) from private.play_visitors v where v.last_day > today - 7 and v.days_seen > 1),
    'returningAllTime', (select count(*) from private.play_visitors v where v.days_seen > 1),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', s.day,
        'players', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'players'), 0),
        'newPlayers', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'new-players'), 0),
        'sessions', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'visit'), 0),
        'seconds', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'played-seconds'), 0)
      ) order by s.day), '[]'::jsonb)
      from (select g::date as day from generate_series(today - 29, today, interval '1 day') as g) as s
    ),
    'month', (
      select coalesce(jsonb_object_agg(x.key, x.count), '{}'::jsonb)
      from (
        select t.metric || case when t.detail = '' then '' else ':' || t.detail end as key, sum(t.count) as count
        from private.play_daily t
        where t.day > today - 30 and t.metric <> 'events'
        group by 1
      ) as x
    ),
    'allTime', (
      select coalesce(jsonb_object_agg(x.key, x.count), '{}'::jsonb)
      from (
        select t.metric || case when t.detail = '' then '' else ':' || t.detail end as key, sum(t.count) as count
        from private.play_daily t
        where t.metric <> 'events' and t.metric <> 'build'
        group by 1
      ) as x
    )
  );
end;
$$;

-- The API's entry points: invokers, carrying only the caller's own rights.
create function public.record_play(visitor_id uuid, build text, events jsonb)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_play(visitor_id, build, events);
$$;

create function public.play_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.play_stats();
$$;

revoke execute on function private.record_play(uuid, text, jsonb) from public, anon;
revoke execute on function public.record_play(uuid, text, jsonb) from public, anon;
revoke execute on function private.play_stats() from public, anon;
revoke execute on function public.play_stats() from public, anon;
-- Counting is done signed out, so the game never signs a visitor up to count them.
grant execute on function private.record_play(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.record_play(uuid, text, jsonb) to anon, authenticated;
grant execute on function private.play_stats() to authenticated;
grant execute on function public.play_stats() to authenticated;
