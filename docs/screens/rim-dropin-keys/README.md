# The jump-in card: arrows between the drop-ins, Enter jumps in

The captain, 26 Nov 2026: "you need to be able to navigate around the drop-ins
with the arrow keys and enter the raid with Enter."

Taken by `tools/playtest/rimCard.mjs` against a test-mode build at 1280x800, on
a save with six ways in.

| | |
|---|---|
| `before-card.png` | `main` before this: the arrows walked the card's rows (three Ups to reach LAND, then Left and Right west to east), and the keys line was hidden in the side column |
| `after-card.png` | the card as it opens, its keys named: `[ARROWS] LAND [ENTER] JUMP IN [TAB] JOB, SKY` |
| `after-arrows.png` | Left, Up, Right from MILL SQUARE: THE QUARRY, the light above, highlighted in the pit |

    node tools/playtest/rimCard.mjs "http://localhost:$PORT/escape-from-pallet-town-web/" out
    node tools/playtest/rimCard.mjs "http://localhost:$PORT/escape-from-pallet-town-web/" out --device=portrait
