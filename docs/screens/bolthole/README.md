# THE BOLTHOLE

The player's own house in the Harbour: FireRed's player's house, downstairs and
up, at the end of the keepers' row behind its window boxes, with a garden and a
sign. Nobody keeps it but you, so there is no counter and no screen behind the
door - what it is for is what stands in it.

| | |
|---|---|
| `harbour-before.png` / `harbour-after.png` | The whole Harbour with every one of Brock's rungs built, before and after (`tools/base/renderBase.mts -- out.png 2 --built=all`). Three columns more to the east hold the house and its garden; the mast moves beside the house; the Pokémon Center is FireRed's own building instead of the CC0 timber house. |
| `garden.png` | Reading the sign beside the path to the step: *THE BOLTHOLE - Home. Nobody hunts you here.* The door's caption says *Your house*. |
| `downstairs.png` | In through the door, on the mat. The sink and hob, the glass cupboard, the telly, the window, the table on its green rug, and the stairs up with the orange mat at their foot. The two columns of bare wall beside the window are kept for what comes next. |
| `upstairs.png` | Up the stairs: arriving on the matching orange mat, facing away from the stairs, with your starter tucked in after you. The PC on its desk, the drawers, the bookcase of toys, the calendar by the stairs, the bed, and the telly and the console on the rug. |

All of the in-game ones are screenshots of a test-mode build at 3x, taken by
`node tools/playtest/bolthole.mjs <url> <dir>`, which walks the whole house -
sign, door, telly, stairs up, bed, PC, console, calendar, stairs down, and out
onto the step - and fails if any of it breaks.

## How it is drawn

The rooms are FireRed's own interior tileset drawn the way the Game Boy Advance
draws it, not a picture of a room: `scripts/cut-frlg-home.mjs` reads
pret/pokefirered's `building` tileset and names every piece by the metatiles
FireRed's own map of the player's house uses (`ASSET_PROVENANCE.md`,
`frlg-home.png`).
