-- The functions that need the table owner's rights live in a schema the API
-- never exposes (Supabase lint 0029); `public` keeps a thin SECURITY INVOKER
-- wrapper for each entry point (next migration).
alter function public.is_admin() set schema private;
alter function public.new_receipt_code() set schema private;
alter function public.submit_map(jsonb, text, text) set schema private;
alter function public.my_submissions() set schema private;

-- The moved submit names the receipt maker by its new schema.
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
  if (map ->> 'format') is distinct from '1' then
    raise exception 'The map is not in a format this game reads.' using errcode = '22023';
  end if;
  if jsonb_typeof(map -> 'name') is distinct from 'string' or char_length(trim(map ->> 'name')) not between 1 and 24 then
    raise exception 'The map needs a name of at most 24 letters.' using errcode = '22023';
  end if;
  if maker_name is null or char_length(trim(maker_name)) not between 1 and 24 then
    raise exception 'The maker needs a name of at most 24 letters.' using errcode = '22023';
  end if;
  ground := map -> 'ground';
  if jsonb_typeof(map -> 'width') is distinct from 'number' or jsonb_typeof(map -> 'height') is distinct from 'number'
    or jsonb_typeof(ground) is distinct from 'array' then
    raise exception 'The map has no ground.' using errcode = '22023';
  end if;
  width := (map ->> 'width')::integer;
  height := (map ->> 'height')::integer;
  if width not between 20 and 128 or height not between 16 and 128 or jsonb_array_length(ground) <> height
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

-- Policies ask the private check now.
alter policy "admins read submissions" on public.map_submissions using ((select private.is_admin()));
alter policy "admins update submissions" on public.map_submissions
  using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "admins see admins" on public.admins using ((select private.is_admin()));
alter policy "admins read blocked makers" on public.blocked_makers using ((select private.is_admin()));
alter policy "admins block makers" on public.blocked_makers with check ((select private.is_admin()));
alter policy "admins unblock makers" on public.blocked_makers using ((select private.is_admin()));

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.submit_map(jsonb, text, text) to authenticated;
grant execute on function private.my_submissions() to authenticated;
