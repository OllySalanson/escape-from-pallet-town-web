-- What an anonymous player holds, cut back to what they use. Anonymous
-- sign-ins are on, and an anonymous user has the `authenticated` role, so
-- every grant and policy for that role was read again with a stranger in mind.
-- Nothing below was reachable in a harmful way - row-level security already
-- refused every one of these - but a grant nobody uses is a grant a later
-- policy can accidentally open.

-- Blocking a maker is an admin's insert; the policy now refuses an anonymous
-- token in its own text, as every other admin policy does.
alter policy "admins block makers" on public.blocked_makers
  with check ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

-- Admins read, block and unblock; nobody updates or truncates the block list,
-- and nobody deletes an admin through the API.
revoke update, truncate, references, trigger on public.blocked_makers from authenticated;
revoke delete on public.admins from authenticated;

-- The upload counter asked about any player by id, which told anyone how
-- busy anyone else had been. It asks about the caller now, and only them.
-- The policy is changed in place, so there is no moment without it; the old
-- counter is left defined but nobody may call it.
create function private.my_feedback_uploads_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects
  where bucket_id = 'feedback' and owner_id = (select auth.uid())::text and created_at > now() - interval '1 day';
$$;

revoke execute on function private.my_feedback_uploads_today() from public, anon;
grant execute on function private.my_feedback_uploads_today() to authenticated;

alter policy "players upload their own feedback files" on storage.objects
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.my_feedback_uploads_today()) < 60
  );

revoke execute on function private.feedback_uploads_today(uuid) from public, anon, authenticated;
