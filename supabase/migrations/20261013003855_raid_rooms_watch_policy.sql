-- A room's channel is watched under the same roles as the harbour's, so the
-- security advisor reads it the same way (lint 0012 asks of a policy written
-- for signed-in players alone whether anonymous ones were meant; they were -
-- every player is one). Somebody signed out is never in a room, so
-- `may_walk_raid_room` answers false for them and nothing more is opened.
grant execute on function private.may_walk_raid_room(text) to anon;

alter policy "room members watch their raid" on realtime.messages
  to anon, authenticated;
