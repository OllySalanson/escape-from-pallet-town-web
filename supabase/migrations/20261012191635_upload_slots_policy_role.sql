-- The upload slots' shut policy names the one role that could ever reach the
-- table directly, rather than every role. Nobody else holds a grant on it and
-- row-level security refuses a role with no policy, so the table stays shut to
-- players exactly as before; written `to public`, the policy matched anonymous
-- players by name and the advisor flagged it (lint 0012), and the advisor must
-- stay empty.
alter policy "only through its functions" on private.feedback_upload_slots to service_role;
