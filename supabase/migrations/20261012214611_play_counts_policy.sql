-- The play counts are read and written only by the two functions that own them
-- (`play_counts`), which run as the tables' owner and so past row-level
-- security. Nobody else holds a grant; this says the same in a policy, as the
-- upload slots do, so the tables are shut twice over and the advisor has
-- nothing to say.
create policy "only through its functions" on private.play_visitors
  as restrictive for all to service_role using (false) with check (false);
create policy "only through its functions" on private.play_daily
  as restrictive for all to service_role using (false) with check (false);
