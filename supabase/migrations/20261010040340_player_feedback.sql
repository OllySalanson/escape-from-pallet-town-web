-- Player feedback: what the FEEDBACK tab sends (`src/game/feedback/`).
--
-- The same shape as map submissions. A player is an anonymous Supabase user;
-- they can upload a message's picture and voice clips into their own folder of
-- a private bucket, and send the message itself through `submit_feedback`, and
-- nothing else - they cannot read anything back, their own included. The
-- owner's PC collects messages with the service key, which bypasses all of
-- this, and admins may read the table from the API.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- What the player was told: FB- and four letters a person can read back.
  tag text not null check (tag ~ '^FB-[A-HJ-NP-Z2-9]{4}$'),
  sender_uid uuid not null references auth.users (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 2000),
  context jsonb not null check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 20000),
  actions jsonb not null check (jsonb_typeof(actions) = 'array' and octet_length(actions::text) <= 20000),
  save text check (save is null or octet_length(save) <= 500000),
  picture_path text,
  voice_paths text[] not null default '{}' check (cardinality(voice_paths) <= 20),
  voice_ms integer not null default 0 check (voice_ms between 0 and 300000),
  -- When SEND was pressed in the game, which may be well before it arrived.
  written_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Set by the owner's PC once it has a copy.
  received_at timestamptz,
  unique (sender_uid, tag)
);

create index feedback_unreceived on public.feedback (created_at) where received_at is null;
create index feedback_sender_created on public.feedback (sender_uid, created_at desc);

alter table public.feedback enable row level security;

create policy "admins read feedback" on public.feedback
  for select to authenticated using ((select private.is_admin()));

revoke all on public.feedback from anon;
revoke insert, update, delete, truncate, references, trigger on public.feedback from authenticated;

-- The pictures and voice clips. Private; a megabyte a file at most (five
-- minutes of speech is under 900 KB); only the formats the game records.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 1048576, array['image/png', 'audio/webm', 'audio/ogg', 'audio/mp4']);

-- How many files a player has put in the bucket today. Asked from a policy on
-- storage.objects, so it reads that table with the owner's rights rather than
-- the caller's, who can see none of it.
create function private.feedback_uploads_today(sender uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects
  where bucket_id = 'feedback' and owner_id = sender::text and created_at > now() - interval '1 day';
$$;

revoke execute on function private.feedback_uploads_today(uuid) from public, anon;
grant execute on function private.feedback_uploads_today(uuid) to authenticated;

-- A player uploads only into their own folder, `<their id>/<tag>/...`, and
-- only so many files a day (five messages of a picture and a few clips each).
create policy "players upload their own feedback files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.feedback_uploads_today((select auth.uid()))) < 60
  );

create function private.submit_feedback(
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

  -- Every file named must be one this player uploaded for this message.
  folder := caller::text || '/' || submit_feedback.tag || '/';
  foreach path in array coalesce(voice_paths, '{}') || case when picture_path is null then '{}'::text[] else array[picture_path] end loop
    if left(path, char_length(folder)) <> folder
      or not exists (select 1 from storage.objects o where o.bucket_id = 'feedback' and o.name = path and o.owner_id = caller::text) then
      raise exception 'A file of this message was not uploaded.' using errcode = '22023';
    end if;
  end loop;

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

revoke execute on function private.submit_feedback(text, text, jsonb, jsonb, text, text, text[], integer, timestamptz) from public, anon;
grant execute on function private.submit_feedback(text, text, jsonb, jsonb, text, text, text[], integer, timestamptz) to authenticated;

-- The API's entry point: an invoker, carrying only the caller's own rights.
create function public.submit_feedback(
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
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.submit_feedback(tag, message, context, actions, save, picture_path, voice_paths, voice_ms, written_at);
$$;

revoke execute on function public.submit_feedback(text, text, jsonb, jsonb, text, text, text[], integer, timestamptz) from public, anon;
grant execute on function public.submit_feedback(text, text, jsonb, jsonb, text, text, text[], integer, timestamptz) to authenticated;
