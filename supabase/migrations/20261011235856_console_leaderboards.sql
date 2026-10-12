-- The house console's leaderboards: a Pallet Town board for every game the
-- console plays (`src/game/console/`), showing players' names and best scores.
--
-- The same shape as feedback and map submissions. A player is an anonymous
-- Supabase user; they post a finished game's score through
-- `submit_console_score` and read a game's board through `console_leaderboard`,
-- and nothing else - the table has no policy a player matches. Admins read it
-- and may hide a row (the MCP refuses delete, and a hidden row is kept as the
-- record of why). Every check the function makes is the game's own rule
-- (`console/playerName.ts`, `console/leaderboard.ts`), so a browser that skips
-- the game's checks is refused the same way.

-- The games a board is kept for. Adding a console game is a row here, in a
-- migration of its own (`console/vendor.test.ts` holds the list to the game's).
create table private.console_games (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name text not null
);
revoke all on private.console_games from public, anon, authenticated;
insert into private.console_games (id, name) values ('pallet-blocks', 'Pallet Blocks');

create table public.console_scores (
  id uuid primary key default gen_random_uuid(),
  game text not null references private.console_games (id),
  player_uid uuid not null references auth.users (id) on delete cascade,
  -- What the player typed, as the console cleans it: capitals, digits and
  -- . ! ? ' - with single spaces inside, at most ten.
  player_name text not null check (player_name ~ '^[A-Z0-9.!?''-]([A-Z0-9 .!?''-]{0,8}[A-Z0-9.!?''-])?$' and player_name !~ '  '),
  score integer not null check (score between 0 and 99999999),
  lines integer not null check (lines between 0 and 99999),
  level integer not null check (level between 1 and 99),
  duration_ms integer not null check (duration_ms between 1000 and 86400000),
  created_at timestamptz not null default now(),
  -- Set by an admin to take a score off the board without losing the row.
  hidden boolean not null default false
);

create index console_scores_board on public.console_scores (game, score desc) where not hidden;
create index console_scores_player_created on public.console_scores (player_uid, created_at desc);
create index console_scores_created on public.console_scores (created_at);

alter table public.console_scores enable row level security;

create policy "admins read console scores" on public.console_scores
  for select to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
create policy "admins hide console scores" on public.console_scores
  for update to authenticated
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

-- A new table in `public` starts shut (feedback_hardening); these are the only
-- grants it has, and each is fenced by a policy above.
revoke all on public.console_scores from anon, authenticated;
grant select on public.console_scores to authenticated;
grant update (hidden) on public.console_scores to authenticated;

-- The word filter every name on the console passes, read exactly as the game
-- reads it (`world/wordFilter.ts`): lookalike characters read back as letters,
-- split into words, a letter tripled squeezed to one, then whole words refused
-- where they stand and stems refused at the start of any word.
-- `console/leaderboardSql.test.ts` holds both word lists to the game's.
create function private.console_name_is_clean(player_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1
    from regexp_split_to_table(
      regexp_replace(translate(lower(player_name), '013457@$!', 'oieastasi'), '(.)\1{2,}', '\1', 'g'),
      '[^a-z]+'
    ) as w(word)
    where w.word <> ''
      and (
        w.word = any (array[
          'arse', 'arsehole', 'ass', 'asshole', 'bastard', 'bellend', 'bollocks', 'boobs', 'cock', 'dick',
          'dickhead', 'dildo', 'fag', 'jizz', 'knob', 'nazi', 'penis', 'piss', 'porn', 'prick', 'pussy',
          'rape', 'retard', 'sex', 'slut', 'spastic', 'tits', 'twat', 'vagina', 'whore'
        ])
        or exists (
          select 1 from unnest(array['fuck', 'shit', 'cunt', 'bitch', 'wank', 'nigg', 'fagg', 'motherf']) as s(stem)
          where starts_with(w.word, s.stem)
        )
      )
  );
$$;

revoke execute on function private.console_name_is_clean(text) from public, anon;
grant execute on function private.console_name_is_clean(text) to authenticated;

-- One finished game's score. The limits are the console's own
-- (`console/leaderboard.ts`, `CONSOLE_SCORE_LIMITS`): a score the game could
-- have reached in the time it was played for, a name the console would have
-- let somebody type, and one post at a time - ten seconds apart, sixty a day
-- from a player and five thousand a day from everybody, counted exactly under
-- a lock as the other two functions count theirs.
create function private.submit_console_score(
  game text,
  player_name text,
  score integer,
  lines integer,
  level integer,
  duration_ms integer
)
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
    raise exception 'Sign in before posting a score.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('submit_console_score', 0));
  if exists (select 1 from public.blocked_makers where maker_uid = caller) then
    raise exception 'This player cannot post scores.' using errcode = '42501';
  end if;
  if not exists (select 1 from private.console_games g where g.id = submit_console_score.game) then
    raise exception 'There is no board for that game.' using errcode = '22023';
  end if;
  if submit_console_score.player_name is null
     or submit_console_score.player_name !~ '^[A-Z0-9.!?''-]([A-Z0-9 .!?''-]{0,8}[A-Z0-9.!?''-])?$'
     or submit_console_score.player_name ~ '  ' then
    raise exception 'A name is capitals, digits and . ! ? '' -, at most ten.' using errcode = '22023';
  end if;
  if not private.console_name_is_clean(submit_console_score.player_name) then
    raise exception 'Pick another name.' using errcode = '22023';
  end if;
  if submit_console_score.score is null or submit_console_score.score not between 0 and 99999999
     or submit_console_score.lines is null or submit_console_score.lines not between 0 and 99999
     or submit_console_score.level is null or submit_console_score.level not between 1 and 99
     or submit_console_score.duration_ms is null or submit_console_score.duration_ms not between 1000 and 86400000
     or submit_console_score.score > (submit_console_score.duration_ms / 1000 + 1)::bigint * 50000 then
    raise exception 'That is not a score a game could finish on.' using errcode = '22023';
  end if;
  if exists (select 1 from public.console_scores s
             where s.player_uid = caller and s.created_at > now() - interval '10 seconds') then
    raise exception 'One score at a time.' using errcode = '54000';
  end if;
  if (select count(*) from public.console_scores s
      where s.player_uid = caller and s.created_at > now() - interval '1 day') >= 60 then
    raise exception 'Sixty scores a day. Try again tomorrow.' using errcode = '54000';
  end if;
  if (select count(*) from public.console_scores s where s.created_at > now() - interval '1 day') >= 5000 then
    raise exception 'The boards are full for today. Try again tomorrow.' using errcode = '54000';
  end if;

  insert into public.console_scores (game, player_uid, player_name, score, lines, level, duration_ms)
  values (
    submit_console_score.game,
    caller,
    submit_console_score.player_name,
    submit_console_score.score,
    submit_console_score.lines,
    submit_console_score.level,
    submit_console_score.duration_ms
  );
  return 'posted';
end;
$$;

revoke execute on function private.submit_console_score(text, text, integer, integer, integer, integer) from public, anon;
grant execute on function private.submit_console_score(text, text, integer, integer, integer, integer) to authenticated;

-- A game's board: every player's best score, best first, ten of them. A
-- hidden score and a blocked player's are left off, and the caller's own row
-- says so, so the console can mark it.
create function private.console_leaderboard(game text)
returns table (player_name text, score integer, lines integer, level integer, posted_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select best.player_name, best.score, best.lines, best.level, best.created_at, best.player_uid = (select auth.uid())
  from (
    select distinct on (s.player_uid) s.player_uid, s.player_name, s.score, s.lines, s.level, s.created_at
    from public.console_scores s
    where s.game = console_leaderboard.game
      and not s.hidden
      and not exists (select 1 from public.blocked_makers b where b.maker_uid = s.player_uid)
    order by s.player_uid, s.score desc, s.created_at asc
  ) as best
  order by best.score desc, best.created_at asc
  limit 10;
$$;

revoke execute on function private.console_leaderboard(text) from public, anon;
grant execute on function private.console_leaderboard(text) to authenticated;

-- The API's entry points: invokers, carrying only the caller's own rights.
create function public.submit_console_score(
  game text,
  player_name text,
  score integer,
  lines integer,
  level integer,
  duration_ms integer
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.submit_console_score(game, player_name, score, lines, level, duration_ms);
$$;

create function public.console_leaderboard(game text)
returns table (player_name text, score integer, lines integer, level integer, posted_at timestamptz, mine boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.console_leaderboard(game);
$$;

revoke execute on function public.submit_console_score(text, text, integer, integer, integer, integer) from public, anon;
revoke execute on function public.console_leaderboard(text) from public, anon;
grant execute on function public.submit_console_score(text, text, integer, integer, integer, integer) to authenticated;
grant execute on function public.console_leaderboard(text) to authenticated;
