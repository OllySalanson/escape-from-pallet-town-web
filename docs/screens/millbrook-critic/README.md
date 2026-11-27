# MILLBROOK, after the critic's first round

The night critics of 26-27 Nov 2026 play each square of Greystone Vale as a
new player who knows FireRed a little. MILLBROOK's first critic scored it 5/10.
This change takes the words it tripped on.

`before/` is the critic's own pictures, on `main` at `fb101e46`; `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build
from a raid stood at Mill Square (`tools/playtest/standRaid.mjs`).

| What | Before | After |
|---|---|---|
| The Centre's one figure was a blonde "Nurse" in front of an empty counter, saying "The machines are spoken for, I am afraid. There is a raid on, you know." She is a WAITING TRAINER now, and says why the counter is empty | `before/1-centre.png` | `after/1-centre.png` |
| Medicine used from the pack named the Pokémon "Charmander", where the fight says CHARMANDER; on a fainted one it said "It will not have any effect on a fainted Pokémon." | `before/3-potion.png` | FireRed's capitals, and "It won't have any effect." (`Bag.test.ts`) |
| LINNET read out a prize table ("BRONZE beats me: ₽30. SILVER, under 0:16.5: ₽40. GOLD,") that the box broke mid-tier | - | "Beat me, ₽30. Under 0:16.5, ₽40. Under 0:11.0, ₽60. First one that fast today gets my purse - any evolution stone you like!" then "Lose, and you still get ₽10 for the legs." (`races.test.ts`) |
| Four villagers gave the same directions the MILL SQUARE sign gives, and most spoke without contractions | - | Lines of their own (`tools/mapcraft/worlds/greystoneVale/millbrook.ts`) |
| BLUE said "Smell ya later!" before the fight as well as after it | - | "Hand it over, or I take it the hard way!" before; his FireRed sign-off stays for the end |
