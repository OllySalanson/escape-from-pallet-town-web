-- The API's entry points: invokers, so they carry only the caller's own rights
-- and reach the privileged work only through the private function each wraps.
create function public.submit_map(map jsonb, maker_name text, resubmits text default null)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.submit_map(map, maker_name, resubmits);
$$;

create function public.my_submissions()
returns table (
  receipt_code text,
  map_name text,
  status text,
  owner_note text,
  revision integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_submissions();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke execute on function public.submit_map(jsonb, text, text) from public, anon;
revoke execute on function public.my_submissions() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.submit_map(jsonb, text, text) to authenticated;
grant execute on function public.my_submissions() to authenticated;
grant execute on function public.is_admin() to authenticated;
