-- A day's uploads are held to a budget in bytes as well as in files (the
-- security review's H1, the red team's F7). Additive: one function body
-- replaced under the same name and arguments, so the game already out there
-- calls it unchanged. No row is changed or removed.
--
-- A name is still handed out only by `reserve_feedback_uploads`, under its
-- lock, and the bucket still takes one file per name and never replaces one
-- (no update or delete policy), so every name it hands out can hold at most
-- one file of at most the bucket's own size limit. That is what lets the
-- budget be exact rather than hopeful: a name whose file has arrived is
-- counted at that file's real size, and a name whose file has not is counted
-- at the most it could ever hold. Asked under the lock, the answer can never
-- be beaten by a burst of uploads, because nothing a burst does can make a
-- name cost more than it was counted at.
--
-- 32 MB a player is one message with a picture and twenty clips (21 names)
-- before any of them arrive, with room over; 200 MB a day for everybody is a
-- fifth of the free plan's storage, against real traffic of a few megabytes.

-- What the names handed out in the last day can hold, for one player or (null)
-- for everybody: a file that has arrived at its real size, a name still empty
-- at the most it could ever hold. A file the collector has since deleted counts
-- at the most again, which only ever errs towards less room. Asked only by
-- `reserve_feedback_uploads`, under its lock.
create function private.feedback_upload_bytes_today(player uuid, most bigint)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, most)), 0)::bigint
  from private.feedback_upload_slots s
  left join storage.objects o on o.bucket_id = 'feedback' and o.name = s.name
  where s.issued_at > now() - interval '1 day'
    and (player is null or s.owner = player);
$$;

create or replace function private.reserve_feedback_uploads(tag text, names text[])
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
  most bigint;
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
  -- The most one name can ever hold: the bucket's own limit.
  select coalesce(b.file_size_limit, 1048576) into most from storage.buckets b where b.id = 'feedback';
  most := coalesce(most, 1048576);
  if private.feedback_upload_bytes_today(caller, most) + wanted * most > 32 * 1048576 then
    raise exception 'Your files for today are used up. Try again tomorrow.' using errcode = '54000';
  end if;
  if private.feedback_upload_bytes_today(null, most) + wanted * most > 200 * 1048576 then
    raise exception 'The lab is full for today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into private.feedback_upload_slots (name, owner)
  select distinct n.name, caller from unnest(names) as n(name)
  on conflict (name) do update set issued_at = now()
    where private.feedback_upload_slots.issued_at <= now() - interval '1 day';
end;
$$;

revoke execute on function private.reserve_feedback_uploads(text, text[]) from public, anon;
grant execute on function private.reserve_feedback_uploads(text, text[]) to authenticated;
revoke execute on function private.feedback_upload_bytes_today(uuid, bigint) from public, anon, authenticated, service_role;
