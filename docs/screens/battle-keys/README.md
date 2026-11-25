# The battle keeps the game's key rules

The navigation audit (25 Nov 2026) found the battle's menus keeping rules of
their own. Now:

- **A click reads a line on**, as in the harbour and a raid. Before, two clicks on
  "The fight picks up where it left off." did nothing (`before-click-on-line.png`),
  so a fight could not be played with the mouse alone. After, the opening lines
  are read by clicks only and the command menu comes up (`after-1-line.png`).
- **Pointing only lights a row.** ITEM, pointed at, is lit in the frame's blue and
  the cursor stays on FIGHT, so a pointer resting on a command no longer decides
  what Space or Enter does (`after-2-pointing-at-item.png`). A move, ball or item
  pointed at still shows its details below the list, and only a click presses.
- **W, A, S and D are the arrows.** D moves the cursor as Right does.
- **Lists stop at their ends.** Right on POKéMON stays on POKéMON instead of
  wrapping round to FIGHT (`after-3-end-of-row.png`).

## How they were made

The before picture is the navigation audit's, on a test-mode build of `main` at
`4bdd8dbd`. The after pictures are
`node tools/playtest/battleKeys.mjs <test-mode build url> <dir>` against a
`VITE_EPTW_TEST_MODE=pixels` build of this branch at 1200x768. It plays each step
with real mouse and key events and fails on the first that goes wrong.
