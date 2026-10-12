-- The STATS page also counts named players: the names chosen at NEW GAME
-- (`unique_names`), so the owner can see visitors becoming players with a
-- name. They are read from `public.player_houses`, the one place a name is
-- kept, never copied into the play counts; only their number and the day each
-- was first chosen leave the table, and only to an admin.

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
    'playersToday', (select count(*) from private.play_visitors v where v.last_day = today),
    'playersWeek', (select count(*) from private.play_visitors v where v.last_day > today - 7),
    'playersAllTime', (select count(*) from private.play_visitors),
    'returningWeek', (select count(*) from private.play_visitors v where v.last_day > today - 7 and v.days_seen > 1),
    'returningAllTime', (select count(*) from private.play_visitors v where v.days_seen > 1),
    -- Named players: the names chosen at NEW GAME, read from where they are
    -- kept rather than counted twice. A house is made the first time a name is
    -- chosen, so its `created_at` is the day that player signed up.
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
        'newNames', (select count(*) from public.player_houses h where (h.created_at at time zone 'Europe/London')::date = s.day)
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
