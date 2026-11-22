# A side panel too short for its screen

Before: at 1024x600, YOUR TEAM (P in the harbour) stood down the right as a column, but the column was 500 pixels tall and the team was 574: the card for the Pokémon under the cursor ran out of the frame and its portrait was drawn over the hint line. After: a column too short for what its screen holds opens as the whole-screen sheet the game already lays out for a narrow window (`fitSidePanel` in `src/game/ui/sidePanel.ts`). At 1280x720 nothing changes.

Made against a test-mode build (`VITE_EPTW_TEST_MODE=1`) on `?testmode=pixels`, in a headless Chromium at each window size, from a save at the harbour, pressing P. `unchanged-1280x720.png` is a save with 18 Pokémon in the boxes.
