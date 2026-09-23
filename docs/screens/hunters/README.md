# Five hunters, a hunter that mirrors the party, medicine packed by default

Playtest 5's three calls from the captain (2026-09-23), photographed from a
`VITE_EPTW_TEST_MODE=pixels` build at 1200x768 by
`tools/playtest/hunterShots.mjs`, on a fresh save with a Lv 5 Bulbasaur.

- `01-loadout-medicine-packed.png` - the loadout opens with the stash's three
  Potions already in the pack. The row says `packed for you`, and the help line
  under the cursor says why and that it can come out.
- `02-final-check-hunter.png` - the final check names who is hunting and what
  they bring: `Hunter: BLUE · 1 Pokémon to your 1 · lead Lv 2 to your Lv 5
  Bulbasaur`.
- `03`-`07` - each of the five arriving, in their own FireRed art and their own
  words: Blue, Misty, Lt. Surge, Koga, Sabrina. A save meets them in that order,
  one raid each; these five were taken in one raid by handing it each rival's
  id, which is the only thing on a rival the raid reads.
- `08-caught-sabrina.png` - walked into: the catch beat speaks her line.
- `09-battle-one-to-one.png` - and the fight is one Pokemon to one, a Rattata
  well under the Bulbasaur.

The numbers behind "easy" are `npx vite-node tools/hunter/measure.mts`,
summarised in `src/game/world/hunter.ts`'s header.
