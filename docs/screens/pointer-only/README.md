# The pointer only lights a thing

The navigation audit (25 Nov 2026) found that on every screen but four, resting
the mouse on a button moved the keyboard highlight there. A pointer left on JUMP
IN on the jump-in card (`before-rim-card.png` is that card) decided what the next
Enter or Space did, and the card says there is no way back. Olly ruled that
pointing only lights a thing, everywhere.

Now, on every pixel-ui screen, the pointer draws a thin ring round what it is
over, and the help bar (and a row's detail pane, and the Pokédex card) answer
what it is over. The highlight - the thing OK presses - stays where the keys or
the last click put it. When the pointer leaves, the answers go back to the
highlight. A click still presses.

`after-pointing.png`: THE POKéDEX, the highlight (red frame) on BULBASAUR, the
pointer resting on PIKACHU (thin ring), and the help bar answering PIKACHU.

## How it was made

`node tools/playtest/pointerOnly.mjs <test-mode build url> <dir>` against a
`VITE_EPTW_TEST_MODE=pixels` build of this branch at 1200x768 (and again at
1600x900). It rests the mouse on a tile, checks the highlight stays and the help
bar answers the tile, moves away and checks the answer comes back, and clicks
the tile to check a click still presses.
