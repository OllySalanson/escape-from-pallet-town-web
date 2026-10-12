-- The red team's database findings of 12 Oct 2026 (F5, F7, F8, F9, F10).
-- Additive throughout: one new private table, new functions, function bodies
-- replaced, a policy altered, grants. No row is changed or removed.

-- F8: a new function anywhere starts shut. The built-in EXECUTE for PUBLIC is
-- global, so the per-schema revoke `feedback_hardening` wrote never reversed
-- it ("per-schema REVOKE is only useful to reverse the effects of a previous
-- per-schema GRANT"); this is the global form. `functionGrants.test.ts` still
-- holds every migration to its own explicit revokes.
alter default privileges for role postgres revoke execute on functions from public;

-- F7: the bucket takes a file only under a name the database handed out.
-- Counting the caller's files from inside the upload policy raced - every
-- upload of a burst saw the count from before the burst - and a policy cannot
-- take a lock. A name is asked for first, through `reserve_feedback_uploads`,
-- which counts under a lock as `submit_feedback` does; a bucket holds one file
-- per name, so the files a player can have are the names they were given.
create table private.feedback_upload_slots (
  name text primary key,
  owner uuid not null,
  issued_at timestamptz not null default now()
);
create index feedback_upload_slots_owner on private.feedback_upload_slots (owner, issued_at);
create index feedback_upload_slots_issued on private.feedback_upload_slots (issued_at);
alter table private.feedback_upload_slots enable row level security;
revoke all on private.feedback_upload_slots from public, anon, authenticated, service_role;

create function private.reserve_feedback_uploads(tag text, names text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  folder text;
  wanted integer;
begin
  if caller is null then
    raise exception 'Sign in before sending feedback.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('reserve_feedback_uploads', 0));
  if reserve_feedback_uploads.tag is null or reserve_feedback_uploads.tag !~ '^FB-[A-HJ-NP-Z2-9]{4}$' then
    raise exception 'That is not a message tag.' using errcode = '22023';
  end if;
  if exists (select 1 from public.blocked_makers where maker_uid = caller) then
    raise exception 'This player cannot send feedback.' using errcode = '42501';
  end if;
  -- The names the game gives one message's files, in this player's folder.
  folder := caller::text || '/' || reserve_feedback_uploads.tag || '/';
  if names is null or cardinality(names) not between 1 and 21
     or exists (select 1 from unnest(names) as n(name)
                where n.name is null
                   or n.name !~ ('^' || folder || '(picture\.png|voice-([1-9]|1[0-9]|20)\.(webm|ogg|m4a))$')) then
    raise exception 'Those are not the files of one message.' using errcode = '22023';
  end if;
  -- A retry asks again for names it already has; only new ones count.
  select count(distinct n.name) into wanted
  from unnest(names) as n(name)
  where not exists (select 1 from private.feedback_upload_slots s
                    where s.name = n.name and s.issued_at > now() - interval '1 day');
  if (select count(*) from private.feedback_upload_slots s
      where s.owner = caller and s.issued_at > now() - interval '1 day') + wanted > 60 then
    raise exception 'Sixty files a day. Try again tomorrow.' using errcode = '54000';
  end if;
  if (select count(*) from private.feedback_upload_slots s where s.issued_at > now() - interval '1 day') + wanted > 600 then
    raise exception 'The lab is full for today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into private.feedback_upload_slots (name, owner)
  select distinct n.name, caller from unnest(names) as n(name)
  on conflict (name) do update set issued_at = now()
    where private.feedback_upload_slots.issued_at <= now() - interval '1 day';
end;
$$;

-- Asked from the upload policy, as the uploader: whether the database handed
-- them this name in the last day.
create function private.feedback_upload_reserved(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.feedback_upload_slots s
    where s.name = object_name and s.owner = (select auth.uid()) and s.issued_at > now() - interval '1 day'
  );
$$;

create function public.reserve_feedback_uploads(tag text, names text[])
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.reserve_feedback_uploads(tag, names);
$$;

revoke execute on function private.reserve_feedback_uploads(text, text[]) from public, anon;
revoke execute on function private.feedback_upload_reserved(text) from public, anon;
revoke execute on function public.reserve_feedback_uploads(text, text[]) from public, anon;
grant execute on function private.reserve_feedback_uploads(text, text[]) to authenticated;
grant execute on function private.feedback_upload_reserved(text) to authenticated;
grant execute on function public.reserve_feedback_uploads(text, text[]) to authenticated;

alter policy "players upload their own feedback files" on storage.objects
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text
                || '/FB-[A-HJ-NP-Z2-9]{4}/(picture\.png|voice-([1-9]|1[0-9]|20)\.(webm|ogg|m4a))$')
    and private.feedback_upload_reserved(name)
  );

-- F5: the two questions the owner's collector asks before it deletes
-- anything, answered by the project over every row rather than by the
-- collector over the first 1000 a read returns. Only the service role may ask.

-- Uploads no message names, older than a day.
create function private.unclaimed_feedback_uploads(older_than_hours integer)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'feedback'
    and o.created_at < now() - make_interval(hours => greatest(older_than_hours, 24))
    and not exists (
      select 1 from public.feedback f
      where f.picture_path = o.name or o.name = any (f.voice_paths)
    )
  order by o.name;
$$;

-- Anonymous visitors not seen for the given days who hold nothing: no
-- message, map, console score, block, admin row or file. "Seen" counts every
-- session refresh, because an anonymous visitor signs in once and lives on
-- refresh tokens after that.
create function private.idle_anonymous_visitors(idle_days integer)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where u.is_anonymous
    and greatest(
          u.created_at,
          u.last_sign_in_at,
          (select max(greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC'))
           from auth.sessions s where s.user_id = u.id)
        ) < now() - make_interval(days => greatest(idle_days, 30))
    and not exists (select 1 from public.feedback f where f.sender_uid = u.id)
    and not exists (select 1 from public.map_submissions m where m.maker_uid = u.id)
    and not exists (select 1 from public.console_scores c where c.player_uid = u.id)
    and not exists (select 1 from public.blocked_makers b where b.maker_uid = u.id)
    and not exists (select 1 from public.admins a where a.user_id = u.id)
    and not exists (select 1 from storage.objects o where o.owner_id = u.id::text)
  order by u.id;
$$;

create function public.unclaimed_feedback_uploads(older_than_hours integer)
returns table (name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.unclaimed_feedback_uploads(older_than_hours);
$$;

create function public.idle_anonymous_visitors(idle_days integer)
returns table (id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.idle_anonymous_visitors(idle_days);
$$;

revoke execute on function private.unclaimed_feedback_uploads(integer) from public, anon, authenticated;
revoke execute on function private.idle_anonymous_visitors(integer) from public, anon, authenticated;
revoke execute on function public.unclaimed_feedback_uploads(integer) from public, anon, authenticated;
revoke execute on function public.idle_anonymous_visitors(integer) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.unclaimed_feedback_uploads(integer) to service_role;
grant execute on function private.idle_anonymous_visitors(integer) to service_role;
grant execute on function public.unclaimed_feedback_uploads(integer) to service_role;
grant execute on function public.idle_anonymous_visitors(integer) to service_role;

-- F9: a name is also read with its spaces and punctuation taken out - every
-- run of its words joined - so `FU CK` is the word it spells. The game's own
-- rule is `isCleanName` (`world/wordFilter.ts`); `console/leaderboardSql.test.ts`
-- holds both word lists to the game's.
create or replace function private.console_name_is_clean(player_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with words as (
    select w.word, row_number() over (order by w.n) as i
    from regexp_split_to_table(
      regexp_replace(translate(lower(player_name), '013457@$!', 'oieastasi'), '(.)\1{2,}', '\1', 'g'),
      '[^a-z]+'
    ) with ordinality as w(word, n)
    where w.word <> ''
  ),
  runs as (
    select regexp_replace(
             (select string_agg(x.word, '' order by x.i) from words x where x.i between f.i and l.i),
             '(.)\1{2,}', '\1', 'g') as word
    from words f join words l on l.i >= f.i
  )
  select not exists (
    select 1 from runs r
    where r.word = any (array[
          'arse', 'arsehole', 'ass', 'asshole', 'bastard', 'bellend', 'bollocks', 'boobs', 'cock', 'dick',
          'dickhead', 'dildo', 'fag', 'jizz', 'knob', 'nazi', 'penis', 'piss', 'porn', 'prick', 'pussy',
          'rape', 'retard', 'sex', 'slut', 'spastic', 'tits', 'twat', 'vagina', 'whore'
        ])
       or exists (
          select 1 from unnest(array['fuck', 'shit', 'cunt', 'bitch', 'wank', 'nigg', 'fagg', 'motherf']) as s(stem)
          where starts_with(r.word, s.stem)
        )
  );
$$;

-- F10: a board can be read signed out, so the console signs nobody up just to
-- look and still shows the boards when sign-ups need a bot check. A signed-out
-- reader owns no row, so `mine` is false rather than unknown.
create or replace function private.console_leaderboard(game text)
returns table (player_name text, score integer, lines integer, level integer, posted_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select best.player_name, best.score, best.lines, best.level, best.created_at,
         coalesce(best.player_uid = (select auth.uid()), false)
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

grant usage on schema private to anon;
grant execute on function private.console_leaderboard(text) to anon;
grant execute on function public.console_leaderboard(text) to anon;
