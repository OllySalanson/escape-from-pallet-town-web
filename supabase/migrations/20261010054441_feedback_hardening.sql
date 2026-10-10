-- What a player can send is what the game sends, and no more: the fixes from
-- the independent security review of 10 Oct 2026 (M1, M2, M3, L4, L5, and the
-- review's notes on indexes and on echoed rows). Nothing here removes a table,
-- a function or a row; ALTER and REVOKE do that work instead.

-- L5: grants nobody uses. PostgreSQL 17's MAINTAIN was missed by the last
-- tidy; and a block's time is the database's to set, not the caller's.
revoke maintain on public.admins, public.blocked_makers, public.feedback, public.map_submissions from authenticated;
revoke insert on public.blocked_makers from authenticated;
grant insert (maker_uid, reason) on public.blocked_makers to authenticated;

-- L5: a new table or function in `public` starts shut, so a migration that
-- forgets its own revoke exposes nothing. Every one so far granted on purpose.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- M1: a file in the bucket is named exactly as the game names it -
-- `<uid>/<tag>/picture.png` or `<uid>/<tag>/voice-<1 to 20>.<webm|ogg|m4a>` -
-- so nothing a stranger names can reach the owner's PC by its own name.
alter policy "players upload their own feedback files" on storage.objects
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text
                || '/FB-[A-HJ-NP-Z2-9]{4}/(picture\.png|voice-([1-9]|1[0-9]|20)\.(webm|ogg|m4a))$')
    and (select private.my_feedback_uploads_today()) < 60
  );

-- L4, M1, M2: one message at a time (so the daily counts are exact), the tag
-- checked before anything else, the files the ones the game names and of the
-- type the game sends, and the message in the shape the owner's PC reads.
create or replace function private.submit_feedback(
  tag text,
  message text,
  context jsonb,
  actions jsonb,
  save text,
  picture_path text,
  voice_paths text[],
  voice_ms integer,
  written_at timestamptz
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  folder text;
  path text;
begin
  if caller is null then
    raise exception 'Sign in before sending feedback.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('submit_feedback', 0));
  if submit_feedback.tag is null or submit_feedback.tag !~ '^FB-[A-HJ-NP-Z2-9]{4}$' then
    raise exception 'That is not a message tag.' using errcode = '22023';
  end if;
  -- A message sent twice - a retry after a lost answer - is the same message.
  if exists (select 1 from public.feedback f where f.sender_uid = caller and f.tag = submit_feedback.tag) then
    return submit_feedback.tag;
  end if;
  if exists (select 1 from public.blocked_makers where maker_uid = caller) then
    raise exception 'This player cannot send feedback.' using errcode = '42501';
  end if;
  if (select count(*) from public.feedback f where f.sender_uid = caller and f.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Five messages a day. Try again tomorrow.' using errcode = '54000';
  end if;
  if (select count(*) from public.feedback f where f.created_at > now() - interval '1 day') >= 100 then
    raise exception 'The lab is full for today. Try again tomorrow.' using errcode = '54000';
  end if;
  if char_length(trim(coalesce(message, ''))) = 0 and coalesce(cardinality(voice_paths), 0) = 0 then
    raise exception 'A message needs words or a recording.' using errcode = '22023';
  end if;

  -- The shape the owner's PC reads: every last move a number and a line, every
  -- piece of where-they-were a string.
  if jsonb_typeof(actions) is distinct from 'array'
     or jsonb_typeof(context) is distinct from 'object'
     or exists (select 1 from jsonb_array_elements(actions) as a(v)
                where jsonb_typeof(a.v) <> 'object'
                   or jsonb_typeof(a.v -> 'at') is distinct from 'number'
                   or jsonb_typeof(a.v -> 'what') is distinct from 'string')
     or exists (select 1 from jsonb_each(context) as c(k, v)
                where c.k in ('version', 'builtAt', 'screen', 'window', 'browser', 'mode', 'takenAt')
                  and jsonb_typeof(c.v) <> 'string')
     or (context ? 'scenes' and (
           jsonb_typeof(context -> 'scenes') <> 'array'
           or exists (select 1 from jsonb_array_elements(context -> 'scenes') as s(v) where jsonb_typeof(s.v) <> 'string')))
     or (context ? 'details' and (
           jsonb_typeof(context -> 'details') <> 'array'
           or exists (select 1 from jsonb_array_elements(context -> 'details') as d(v)
                      where jsonb_typeof(d.v) <> 'object'
                         or jsonb_typeof(d.v -> 'label') is distinct from 'string'
                         or jsonb_typeof(d.v -> 'value') is distinct from 'string')))
  then
    raise exception 'The message is not in the shape the game sends.' using errcode = '22023';
  end if;

  -- Every file is the one the game names, uploaded by this player, of the type
  -- the game sends: the picture a PNG, each clip audio, numbered in order.
  folder := caller::text || '/' || submit_feedback.tag || '/';
  if picture_path is not null and (
       picture_path <> folder || 'picture.png'
       or not exists (select 1 from storage.objects o
                      where o.bucket_id = 'feedback' and o.name = picture_path and o.owner_id = caller::text
                        and o.metadata ->> 'mimetype' = 'image/png')) then
    raise exception 'A file of this message was not uploaded.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(voice_paths, '{}')) with ordinality as v(path, n)
    where v.path !~ ('^' || folder || 'voice-' || v.n || '\.(webm|ogg|m4a)$')
       or not exists (select 1 from storage.objects o
                      where o.bucket_id = 'feedback' and o.name = v.path and o.owner_id = caller::text
                        and o.metadata ->> 'mimetype' like 'audio/%')
  ) then
    raise exception 'A file of this message was not uploaded.' using errcode = '22023';
  end if;

  insert into public.feedback (tag, sender_uid, message, context, actions, save, picture_path, voice_paths, voice_ms, written_at)
  values (
    submit_feedback.tag,
    caller,
    coalesce(trim(message), ''),
    context,
    actions,
    save,
    picture_path,
    coalesce(voice_paths, '{}'),
    coalesce(voice_ms, 0),
    least(coalesce(written_at, now()), now())
  );
  return submit_feedback.tag;
end;
$$;

-- L4, M3: one map at a time, only the keys a map file has (so nothing the
-- reviewer cannot see can ride an approval into the repo), and no markup
-- characters in either name - the game's own rule (`UNSAFE_TEXT`), now the
-- database's too. The key list is `MAP_FILE_KEYS` and the sizes are
-- `MAP_FILE_LIMITS` (`src/game/world/mapFile.ts`), which raised maps to
-- 256x256; `src/game/maker/submissionLimits.test.ts` fails when they disagree,
-- so a new part of the map format arrives with a migration that lets it in.
create or replace function private.submit_map(map jsonb, maker_name text, resubmits text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  previous public.map_submissions%rowtype;
  code text;
  ground jsonb;
  width integer;
  height integer;
begin
  if caller is null then
    raise exception 'Sign in before sending a map.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('submit_map', 0));
  if exists (select 1 from public.blocked_makers where maker_uid = caller) then
    raise exception 'This maker cannot send maps.' using errcode = '42501';
  end if;
  if (select count(*) from public.map_submissions where maker_uid = caller and created_at > now() - interval '1 day') >= 3 then
    raise exception 'You can send three maps a day. Try again tomorrow.' using errcode = '54000';
  end if;
  if (select count(*) from public.map_submissions where created_at > now() - interval '1 day') >= 300 then
    raise exception 'The inbox is full for today. Try again tomorrow.' using errcode = '54000';
  end if;

  if jsonb_typeof(map) is distinct from 'object' or octet_length(map::text) > 250000 then
    raise exception 'That is not a map file, or it is too big.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(map) as k(key)
             where k.key not in ('format', 'id', 'name', 'maker', 'width', 'height', 'ground', 'buildings',
                                 'dropIns', 'exits', 'itemSpots', 'wildlife', 'people', 'signs', 'landmarks',
                                 'districts', 'trainers', 'doors', 'pokemon')) then
    raise exception 'That is not a map file, or it is too big.' using errcode = '22023';
  end if;
  if (map ->> 'format') is distinct from '1' then
    raise exception 'The map is not in a format this game reads.' using errcode = '22023';
  end if;
  if jsonb_typeof(map -> 'name') is distinct from 'string' or char_length(trim(map ->> 'name')) not between 1 and 24 then
    raise exception 'The map needs a name of at most 24 letters.' using errcode = '22023';
  end if;
  if maker_name is null or char_length(trim(maker_name)) not between 1 and 24 then
    raise exception 'The maker needs a name of at most 24 letters.' using errcode = '22023';
  end if;
  if maker_name ~ '[<>&"]' or (map ->> 'name') ~ '[<>&"]' then
    raise exception 'Names in a map may not use < > & or ".' using errcode = '22023';
  end if;
  ground := map -> 'ground';
  if jsonb_typeof(map -> 'width') is distinct from 'number' or jsonb_typeof(map -> 'height') is distinct from 'number'
    or jsonb_typeof(ground) is distinct from 'array' then
    raise exception 'The map has no ground.' using errcode = '22023';
  end if;
  width := (map ->> 'width')::integer;
  height := (map ->> 'height')::integer;
  if width not between 20 and 256 or height not between 16 and 256 or jsonb_array_length(ground) <> height
    or exists (
      select 1 from jsonb_array_elements(ground) as cell(row)
      where jsonb_typeof(cell.row) <> 'string' or char_length(cell.row #>> '{}') <> width
    ) then
    raise exception 'The map''s ground is not the size it says.' using errcode = '22023';
  end if;

  if resubmits is not null then
    select * into previous from public.map_submissions where receipt_code = upper(resubmits);
    if not found or previous.maker_uid <> caller or previous.status <> 'sent_back' then
      raise exception 'Only a map sent back to you can be sent again.' using errcode = '42501';
    end if;
  end if;

  code := private.new_receipt_code();
  insert into public.map_submissions (receipt_code, maker_uid, maker_name, map_name, map, format, revision, revision_of)
  values (
    code,
    caller,
    trim(maker_name),
    trim(map ->> 'name'),
    map,
    1,
    case when resubmits is null then 1 else previous.revision + 1 end,
    case when resubmits is null then null else previous.id end
  );
  return code;
end;
$$;

-- Indexes for the overall daily counts.
create index feedback_created on public.feedback (created_at);
create index map_submissions_created on public.map_submissions (created_at);

-- L6: the test messages already in the inbox, from building and reviewing this
-- (game test drivers, probes, the 5-a-day test, the review's own probe), are
-- marked as received long ago, so the owner's collector clears them out of the
-- project - rows and files - on its first run instead of presenting them as
-- player notes. They are named one by one, by tag and by the moment they
-- arrived, so a real message can never be caught.
update public.feedback
set received_at = '2000-01-01T00:00:00Z'
where received_at is null
  and created_at < '2026-10-10T05:30:00Z'
  and tag in ('FB-5HB5', 'FB-524X', 'FB-PRA2', 'FB-PRA3', 'FB-PRA4', 'FB-PRA5', 'FB-PRA6',
              'FB-A44Y', 'FB-KGH4', 'FB-PRBE', 'FB-3YZ8', 'FB-3EN9', 'FB-ZZZZ');
