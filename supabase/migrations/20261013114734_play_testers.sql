-- Real players, testers and machines, counted apart (`analytics/playCounter.ts`).
--
-- The first night of counting said six players, and every one was a machine:
-- five page loads inside fifteen seconds from Google Cloud addresses, each in
-- a different made-up browser (a 2019 iPhone, an Android 8 phone, no browser
-- name at all), and a headless Chrome from a Palo Alto Networks address ten
-- minutes later - link scanners opening the published address, staying the
-- fifteen seconds before the first batch goes, and never pressing a key. The
-- game now sends nothing until a person presses a key or clicks, and nothing
-- from an automated browser or from anywhere but the published address; this
-- is the database's half.
--
-- A browser is in one of three cohorts. `player` is everybody, as before.
-- `tester` is a browser that says it is one: the owner's own, or a friend
-- helping test, marked by the switch on the STATS page or by opening the game
-- once with `?tester` (`playCounter.ts`). Anybody can say it - which can only
-- take a browser out of the real count, never put one in - so it needs no
-- sign-in and is sent with every batch, the last word winning, so a browser
-- can be unmarked again. `automated` is only ever written here, by hand, for
-- rows the evidence shows were machines, and is never taken back.
--
-- Still nothing personal: the cohort is one word on the row that was already
-- a random id. A tester's moments go into the same daily totals under a
-- prefixed name (`tester:visit`), a machine's under `automated:`, so the real
-- totals keep their names and every older answer still reads.

alter table private.play_visitors
  add column cohort text not null default 'player'
  constraint play_visitors_cohort check (cohort in ('player', 'tester', 'automated'));

-- One batch of counted moments from one browser, and whether it is a tester's.
-- The checks are `play_counts`' own, word for word.
create function private.record_play(visitor_id uuid, build text, events jsonb, tester boolean)
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
  counted_as text;
  prefix text;
begin
  if visitor_id is null then
    raise exception 'A visitor is needed.' using errcode = '22023';
  end if;
  if record_play.build is null or record_play.build !~ '^[A-Za-z0-9._-]{1,40}$' then
    raise exception 'That is not a build.' using errcode = '22023';
  end if;
  if record_play.tester is null then
    raise exception 'A tester or not is needed.' using errcode = '22023';
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
  -- one after the other. A refusal rolls every count back with it. The cohort
  -- is the batch's word, except that a machine stays a machine.
  insert into private.play_visitors as v (visitor, first_day, last_day, previous_day, days_seen, events_today, cohort)
  values (visitor_id, today, today, null, 1, n, case when record_play.tester then 'tester' else 'player' end)
  on conflict (visitor) do update set
    previous_day = v.last_day,
    days_seen = v.days_seen + case when v.last_day < today then 1 else 0 end,
    events_today = case when v.last_day < today then excluded.events_today else v.events_today + excluded.events_today end,
    last_day = today,
    cohort = case when v.cohort = 'automated' then v.cohort else excluded.cohort end
  returning v.events_today, v.previous_day, v.cohort into mine, before, counted_as;
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

  -- A real player's moments keep their own names; anybody else's are named
  -- for who sent them.
  prefix := case when counted_as = 'player' then '' else counted_as || ':' end;

  -- Who: a player today, and new or returning.
  if before is null or before < today then
    insert into private.play_daily as t (day, metric, detail, count)
    values (today, prefix || 'players', '', 1), (today, prefix || case when before is null then 'new-players' else 'returning-players' end, '', 1)
    on conflict (day, metric, detail) do update set count = t.count + excluded.count;
  end if;

  -- What: each moment counted into the day, and which build a session ran.
  insert into private.play_daily as t (day, metric, detail, count)
  select today, prefix || m.metric, m.detail, sum(m.count)
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

-- What a page still open on an older build sends: a batch with no word on
-- testers, counted as a player's, as it always was.
create or replace function private.record_play(visitor_id uuid, build text, events jsonb)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.record_play(visitor_id, build, events, false);
$$;

create function public.record_play(visitor_id uuid, build text, events jsonb, tester boolean)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_play(visitor_id, build, events, tester);
$$;

-- The owner's page: the headline numbers are real players only, with the
-- testers' own beside them and the machines' all-time count under that.
create or replace function private.play_stats()
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
    'playersToday', (select count(*) from private.play_visitors v where v.cohort = 'player' and v.last_day = today),
    'playersWeek', (select count(*) from private.play_visitors v where v.cohort = 'player' and v.last_day > today - 7),
    'playersAllTime', (select count(*) from private.play_visitors v where v.cohort = 'player'),
    'returningWeek', (select count(*) from private.play_visitors v where v.cohort = 'player' and v.last_day > today - 7 and v.days_seen > 1),
    'returningAllTime', (select count(*) from private.play_visitors v where v.cohort = 'player' and v.days_seen > 1),
    'testersToday', (select count(*) from private.play_visitors v where v.cohort = 'tester' and v.last_day = today),
    'testersWeek', (select count(*) from private.play_visitors v where v.cohort = 'tester' and v.last_day > today - 7),
    'testersAllTime', (select count(*) from private.play_visitors v where v.cohort = 'tester'),
    'automatedAllTime', (select count(*) from private.play_visitors v where v.cohort = 'automated'),
    -- Named players: the names chosen at NEW GAME, read from where they are
    -- kept rather than counted twice. A house is made the first time a name is
    -- chosen, so its `created_at` is the day that player signed up. A name is
    -- never tied to a browser id, so testers' names are counted here too.
    'namedToday', (select count(*) from public.player_houses h where (h.created_at at time zone 'Europe/London')::date = today),
    'namedWeek', (select count(*) from public.player_houses h where (h.created_at at time zone 'Europe/London')::date > today - 7),
    'namedAllTime', (select count(*) from public.player_houses),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', s.day,
        'players', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'players'), 0),
        'newPlayers', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'new-players'), 0),
        'sessions', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'visit'), 0),
        'seconds', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'played-seconds'), 0),
        'newNames', (select count(*) from public.player_houses h where (h.created_at at time zone 'Europe/London')::date = s.day),
        'testers', coalesce((select t.count from private.play_daily t where t.day = s.day and t.metric = 'tester:players'), 0)
      ) order by s.day), '[]'::jsonb)
      from (select g::date as day from generate_series(today - 29, today, interval '1 day') as g) as s
    ),
    -- Totals by `metric` or `metric:detail`, real players' only: a tester's
    -- or a machine's metric carries its cohort and a colon, and a real one never does.
    'month', (
      select coalesce(jsonb_object_agg(x.key, x.count), '{}'::jsonb)
      from (
        select t.metric || case when t.detail = '' then '' else ':' || t.detail end as key, sum(t.count) as count
        from private.play_daily t
        where t.day > today - 30 and t.metric <> 'events' and position(':' in t.metric) = 0
        group by 1
      ) as x
    ),
    'allTime', (
      select coalesce(jsonb_object_agg(x.key, x.count), '{}'::jsonb)
      from (
        select t.metric || case when t.detail = '' then '' else ':' || t.detail end as key, sum(t.count) as count
        from private.play_daily t
        where t.metric <> 'events' and t.metric <> 'build' and position(':' in t.metric) = 0
        group by 1
      ) as x
    ),
    -- The testers' last thirty days, the same way with the cohort taken off.
    'testerMonth', (
      select coalesce(jsonb_object_agg(x.key, x.count), '{}'::jsonb)
      from (
        select substr(t.metric, length('tester:') + 1) || case when t.detail = '' then '' else ':' || t.detail end as key, sum(t.count) as count
        from private.play_daily t
        where t.day > today - 30 and t.metric like 'tester:%'
        group by 1
      ) as x
    )
  );
end;
$$;

revoke execute on function private.record_play(uuid, text, jsonb, boolean) from public, anon;
revoke execute on function public.record_play(uuid, text, jsonb, boolean) from public, anon;
revoke execute on function private.record_play(uuid, text, jsonb) from public, anon;
revoke execute on function private.play_stats() from public, anon;
-- Counting is done signed out, so the game never signs a visitor up to count them.
grant execute on function private.record_play(uuid, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.record_play(uuid, text, jsonb, boolean) to anon, authenticated;
grant execute on function private.record_play(uuid, text, jsonb) to anon, authenticated;
grant execute on function private.play_stats() to authenticated;

-- The first night's six, every one a machine (see the top of this file):
-- the browsers marked, and their moments moved out of the real totals under
-- the `automated:` names. They were the only moments that day had, which is
-- what the guards say: a total that has moved on is left alone.
update private.play_visitors set cohort = 'automated'
where visitor in (
  'a042499e-02ae-4062-b3e1-78ef3eb3f526',
  '9190ef5a-908d-4b08-875b-8a1ea0009fc5',
  '2ceb857a-3b64-444b-881e-53f7312d71e3',
  '52224be6-a33c-4df9-a6e8-1bfebf4f5335',
  '886cc0ba-b1a3-44d3-9046-28a32ec71048',
  '17ffde36-9234-4a3d-a246-215b9f7b8062'
) and first_day = date '2026-10-13';

insert into private.play_daily (day, metric, detail, count)
select date '2026-10-13', 'automated:' || moved.metric, moved.detail, moved.count
from (values ('players', '', 6), ('new-players', '', 6), ('visit', '', 6), ('played-seconds', '', 75), ('build', '8eb0da7', 6))
  as moved(metric, detail, count)
where (select count(*) from private.play_visitors v where v.cohort = 'automated') = 6;

update private.play_daily t set count = t.count - moved.count
from (values ('players', '', 6), ('new-players', '', 6), ('visit', '', 6), ('played-seconds', '', 75), ('build', '8eb0da7', 6))
  as moved(metric, detail, count)
where t.day = date '2026-10-13' and t.metric = moved.metric and t.detail = moved.detail and t.count >= moved.count
  and exists (select 1 from private.play_daily a where a.day = date '2026-10-13' and a.metric = 'automated:players');
