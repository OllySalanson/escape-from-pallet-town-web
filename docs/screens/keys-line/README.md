# Every screen keeps its keys line

The navigation audit (25 Nov 2026) found that the hall's panels - the bench, the
rack, the locker, the raid result - each had a keys line in their markup, but the
help bar showed the highlighted control's help instead, and every control has
help, so the keys line was hidden from the first frame (`before-bench.png`,
`before-rack.png`).

Now the help bar is three lines on every pixel-ui screen: the help for the thing
under the cursor (or the pointer) on the top two, and the screen's keys on the
bottom one, which nothing replaces. The rack names its own keys: "UP DOWN move ·
LEFT RIGHT how many · TAB the pack · ESC back" (`after-rack.png`). THE POKéDEX
keeps "ARROWS move · ENTER opens a page · X close" under the tile's line
(`after-pokedex.png`).

## How they were made

The before pictures are the navigation audit's. The after pictures are
`node tools/playtest/rackTab.mjs` and `node tools/playtest/pointerOnly.mjs`
against a `VITE_EPTW_TEST_MODE=pixels` build of this branch at 1200x768.
