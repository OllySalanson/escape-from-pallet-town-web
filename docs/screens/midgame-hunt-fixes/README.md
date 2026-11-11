# Fixes from the midgame bug hunt (11 Nov 2026)

## 1. A double press at Bill's buys nothing

The hunt's finding 1, played end to end by `tools/playtest/billShelf.mjs` in a headless Chromium against a `VITE_EPTW_TEST_MODE=pixels` build served under the Pages subpath, at `PIXEL_WINDOW`. The save is a PARTNER with Bill (three a trip) holding ₽1000. Each double press is two presses of one key three frames apart on a stepped loop. The "before" pictures are a build of `main` at `0c767d33`; the "after" ones a build of this branch. `node tools/playtest/billShelf.mjs <url> <dir> --before` records what an older build does without failing.

### His whole list (the PC in his cottage)

- `1-before-list-double-enter-bought-two.png`: ENTER twice on POTION bought two. ₽880 became ₽640, the deck says 0 OF 3 LEFT THIS TRIP with every row SPENT, and the status line says only "Bought one for ₽120."
- `3-after-list-asks-on-keep-them.png`: one ENTER turns the row into the question "Pay ₽120 for a Potion?" with the cursor on KEEP THEM, as his barters and the berth already did. The second ENTER of a double press lands on KEEP THEM: nothing is spent and the cursor goes back to the Potion.
- `4-after-list-buy-buys-one.png`: ENTER, RIGHT, ENTER on purpose buys exactly one and says so.

### His cottage shelves

- `2-before-cottage-double-press-bought-one.png`: a double press on the last line of what he says about the Potion bought it. The first press raised "Buy one for ₽120?" on YES and the second answered it.
- `5-after-cottage-asks-on-not-now.png`: the question opens on NOT NOW, as his barters, the berth and Nurse Joy's paid healing do. A double press there answers NOT NOW ("It will be here.") and spends nothing; LEFT then SPACE still buys.

## 2. The field guide counts the walk from where you stand

A save five jobs down the board (a Sealed dispatch), deployed at FARMHOUSE, field guide opened on landing - a throwaway driver over `deploy.mjs` (`--insertion=greystone-vale-farmhouse --banked=5`), the same two builds.

- `6-before-guide-counts-from-the-front-door.png`: "The case is in the north of the map, 227 steps from Greystone Vale." Greystone Vale is the front door; the player was at FARMHOUSE, 195 steps from it.
- `7-after-guide-counts-from-here.png`: "The next stop is to the north, 195 steps away." - measured by the walk from the player's own tile each time the guide opens - and the briefing names no distance from a landing.

## 3 and 4, in words

- A job no longer names an exit that opens late or on a landmark (SMUGGLERS' BOAT at 2:30, LINESMEN'S TRACK behind the RELAY MAST): `standingBoard.test.ts` holds it over the vale's real boards for 0 to 59 jobs banked with no badge, Misty's and both.
- Misty's and Koga's badge lines now say a drop-in point in their quarter has to be reached before a raid can start from it: "Reach a drop-in point past them, and you can start a raid from it."
