-- `admin_is_the_owner` rewrote `private.is_admin`, which keeps the grants it
-- had (authenticated only). Said here in its own words, as every migration
-- says it of the functions it writes (`maker/functionGrants.test.ts`).
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
