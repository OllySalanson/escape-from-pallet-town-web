-- The upload slots are read and written only by the two functions that own
-- them (`redteam_fixes`), which run as the table's owner and so past its
-- row-level security. Nobody else holds a grant; this says the same in a
-- policy, so the table is shut twice over and the advisor has nothing to say.
create policy "only through its functions" on private.feedback_upload_slots
  as restrictive for all to public using (false) with check (false);
