-- Player map submissions: the inbox the captain reviews.
--
-- Nobody but an admin reads or changes this table. A maker - an anonymous
-- Supabase user, signed in from the game behind a bot check - can only send
-- a map in through `submit_map` and ask after their own maps through
-- `my_submissions`; both are security definer functions that check who is
-- calling, so the table itself carries no policy a player matches.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.blocked_makers (
  maker_uid uuid primary key,
  reason text,
  created_at timestamptz not null default now()
);

create table public.map_submissions (
  id uuid primary key default gen_random_uuid(),
  receipt_code text not null unique,
  maker_uid uuid not null references auth.users (id) on delete cascade,
  maker_name text not null check (char_length(maker_name) between 1 and 24),
  map_name text not null check (char_length(map_name) between 1 and 24),
  map jsonb not null check (octet_length(map::text) <= 250000),
  format integer not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'sent_back', 'approved', 'rejected', 'published')),
  owner_note text check (owner_note is null or char_length(owner_note) <= 2000),
  revision integer not null default 1 check (revision >= 1),
  revision_of uuid references public.map_submissions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index map_submissions_maker_created on public.map_submissions (maker_uid, created_at desc);
create index map_submissions_status_created on public.map_submissions (status, created_at);
create index map_submissions_revision_of on public.map_submissions (revision_of);

alter table public.admins enable row level security;
alter table public.blocked_makers enable row level security;
alter table public.map_submissions enable row level security;

-- Whether the caller is one of the people who review maps.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Admins read and decide; nobody deletes through the API.
create policy "admins read submissions" on public.map_submissions
  for select to authenticated using ((select public.is_admin()));
create policy "admins update submissions" on public.map_submissions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins see admins" on public.admins
  for select to authenticated using ((select public.is_admin()));
create policy "admins read blocked makers" on public.blocked_makers
  for select to authenticated using ((select public.is_admin()));
create policy "admins block makers" on public.blocked_makers
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins unblock makers" on public.blocked_makers
  for delete to authenticated using ((select public.is_admin()));

-- Nothing on these tables is for an anonymous browser that has not signed in.
revoke all on public.admins, public.blocked_makers, public.map_submissions from anon;
revoke insert, delete, truncate, references, trigger on public.map_submissions from authenticated;
revoke insert, update, truncate, references, trigger on public.admins from authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger map_submissions_touch
  before update on public.map_submissions
  for each row execute function public.touch_updated_at();

-- A receipt a maker can read out: no 0/O or 1/I/L to confuse.
create function public.new_receipt_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..10 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.map_submissions where receipt_code = code);
  end loop;
  return code;
end;
$$;

/*
  Sends a map in. Returns the receipt code.

  The map is checked for shape here - format, names, size, the ground a
  rectangle of the size it says - and checked in full by the game's own
  `checkMapFile` before it is ever published; this is only what keeps the
  inbox from filling with things that are not maps. Limits: three maps a day
  from one maker, three hundred a day from everyone, 250 KB each.

  `resubmits` is the receipt of a map the captain sent back: the new map is
  its next revision, and only its own maker can send one.
*/
create function public.submit_map(map jsonb, maker_name text, resubmits text default null)
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

  if jsonb_typeof(map) <> 'object' or octet_length(map::text) > 250000 then
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

  code := public.new_receipt_code();
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

-- What a maker can know about their own maps: never the map itself, never anyone else's.
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
security definer
set search_path = ''
as $$
  select s.receipt_code, s.map_name, s.status, s.owner_note, s.revision, s.created_at, s.updated_at
  from public.map_submissions s
  where s.maker_uid = (select auth.uid())
  order by s.created_at desc
  limit 50;
$$;

revoke execute on function public.submit_map(jsonb, text, text) from public, anon;
revoke execute on function public.my_submissions() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.new_receipt_code() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
grant execute on function public.submit_map(jsonb, text, text) to authenticated;
grant execute on function public.my_submissions() to authenticated;
grant execute on function public.is_admin() to authenticated;
