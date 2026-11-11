# Fixes from the arenas bug hunt

The "before" pictures are the hunt's own, taken on `main` at `9edfed70`. The "after" pictures were taken on this branch, against a `VITE_EPTW_TEST_MODE=pixels` build served as static files, except the class bout's question, which was taken against a plain build at real speed.

## YIELD asks first when a loss costs something

- `before-yield-one-press.png` - one press of YIELD on a WATER CUP run ended the run at once.
- `after-yield-asks-hall.png` - `node tools/playtest/arenaFun.mjs <build url> <dir> --only=bout`, shot `bout-yield-asks`: a hall bout with one rival beaten asks "Yield the bout?" and names the run it ends, with the cursor on NO.
- `after-yield-asks-class.png` - a class bout with a run of two, pressed Right then SPACE at real speed on the plain build.

A bout that costs nothing still yields on one press.

## START AGAIN fights bout one

- `before-start-again-fights-bout-five.png` - START AGAIN with the same three said "PRACTICE · 1 OF 7" but fought 1MORERAID's bout-five team.
- `after-start-again-same-three.png` and `after-start-again-fights-bout-one.png` - `node tools/playtest/arenaCups.mjs <build url> <dir>`, shots `06-start-again-same-three` and `rental-bout`: the page names BULBALUV for bout one, and BULBALUV is who is fought.

## Whole-look cards say when a raid find is needed

- `before-boutique-plain-price.png` - Mewtwo's card said a plain price, though its robe is only found on raids.
- `after-boutique-raid-find.png` - the same shelf on this branch: Mew, Articuno, Moltres and Mewtwo say "+ a raid find", and Zapdos says "+ 2 raid finds". It was taken by a scratch script that walks a new game into THE HARBOUR BOUTIQUE and moves the cursor to Mewtwo with the arrow keys.
