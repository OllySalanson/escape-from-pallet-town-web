-- Who reviews player maps: the game's owner, by his GitHub account's own
-- numeric id (OllySalanson, 40039465), granted when that identity first signs
-- in. An id, not a name: a GitHub login can be renamed and taken, an account
-- id cannot, and only someone who can sign in to that account can make
-- Supabase record it.
create function private.grant_owner_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'github' and new.provider_id = '40039465' then
    insert into public.admins (user_id) values (new.user_id) on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function private.grant_owner_review() from public, anon, authenticated;

create trigger grant_owner_review
  after insert on auth.identities
  for each row execute function private.grant_owner_review();

-- A reviewer decides a map; they do not rewrite who sent it or when. Updating
-- is narrowed to the four things a decision changes, on top of the admins-only
-- policy.
revoke update on public.map_submissions from authenticated;
grant update (status, owner_note, map, map_name) on public.map_submissions to authenticated;
