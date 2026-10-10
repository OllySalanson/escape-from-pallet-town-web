-- The same rule as admins_not_anonymous, written so the token is read once
-- per query rather than once per row (Supabase's performance lint 0003): the
-- select wraps auth.jwt() itself, not the expression built on it.
alter policy "admins see admins" on public.admins
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "admins read blocked makers" on public.blocked_makers
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "admins unblock makers" on public.blocked_makers
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "admins read feedback" on public.feedback
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "admins read submissions" on public.map_submissions
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "admins update submissions" on public.map_submissions
  using ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check ((select private.is_admin()) and ((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
