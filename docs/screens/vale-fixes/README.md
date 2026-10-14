# Greystone Vale: the far places' playtest fixes

From the overnight playtest of the vale's six far places (B1-B6).

- `b1-skiff-in-on-a-short-clock.png`, `b1-out-by-the-cinder-boat.png`: a
  normal save with a 110 s Pokemon Center debt (a 3:10 raid) at Cove Steps.
  The Smugglers' Run, drawn for 1:00-2:30, is in from the start; the Cinder
  Boat, drawn for 3:20, opens at 1:30 and the raid leaves by it at 1:34. Before,
  the boat opened after the raid had ended and the pack was lost.
- `b2-island-hunter-ashore-behind.png`: the same raid on Ember Isle when the
  hunter arrives at 1:11 - six tiles from the mainland jetty the player sailed
  from, not five steps away on the beach.
- `b4-strand-rocks-after.png`, `b4-strand-stair-after.png`: Gull Strand's rocks
  on sand without a square of lawn, and the cliff path ending on the outcrop's
  grassy top above the steps.

Played with one stepped headless browser on a test-mode build
(`VITE_EPTW_TEST_MODE=1 npx vite build`), deployed by `tools/playtest/deploy.mjs`
with the save's `pendingRecoveryMs` set; pictures of the map by
`tools/tileset/renderMap.mts -- greystone-vale <out> <zoom> --crop=...`.
