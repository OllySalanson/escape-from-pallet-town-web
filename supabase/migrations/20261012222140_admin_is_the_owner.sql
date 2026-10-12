-- Only the game's owner is ever an admin - the one who reviews player maps and
-- reads the play stats - and the database, not a sign-in order, says so. The
-- owner is a GitHub account by its numeric id (OllySalanson, 40039465): an id,
-- never a name, because a login can be renamed and taken and only someone who
-- can sign in to that account can make Supabase record its identity.
--
-- `grant_owner_review` (`owner_reviews`) already grants the row only to that
-- identity. This makes it the rule rather than the habit of one trigger: an
-- admins row is refused for anybody else, however it is written, and
-- `is_admin` asks for the identity as well as the row - so a row for anybody
-- else, were one ever there, would count for nothing (none is: the table was
-- empty when this was written).

create function private.is_owner(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.identities i
    where i.user_id = is_owner.uid and i.provider = 'github' and i.provider_id = '40039465'
  );
$$;

revoke execute on function private.is_owner(uuid) from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
    and private.is_owner((select auth.uid()));
$$;

create function private.admins_are_the_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner(new.user_id) then
    raise exception 'Only the owner''s GitHub account can be an admin.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.admins_are_the_owner() from public, anon, authenticated;

create trigger admins_are_the_owner
  before insert or update on public.admins
  for each row execute function private.admins_are_the_owner();
