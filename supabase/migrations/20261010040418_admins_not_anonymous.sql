-- Anonymous sign-ins are on (players send maps and feedback without an
-- account), and an anonymous user is an `authenticated` one. Every policy that
-- reads or changes the review tables was already admins-only through
-- `private.is_admin()`, which no anonymous user can pass - this says so in the
-- policy itself, so that is checked by the reader of the policy rather than by
-- the contents of `public.admins`, and so Supabase's advisor (lint 0012) can
-- see it.
alter policy "admins see admins" on public.admins
  using ((select private.is_admin()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "admins read blocked makers" on public.blocked_makers
  using ((select private.is_admin()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "admins unblock makers" on public.blocked_makers
  using ((select private.is_admin()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "admins read feedback" on public.feedback
  using ((select private.is_admin()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "admins read submissions" on public.map_submissions
  using ((select private.is_admin()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
alter policy "admins update submissions" on public.map_submissions
  using ((select private.is_admin()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
  with check ((select private.is_admin()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
