# FireRed's own rooms

The second step of insides (`docs/maker-areas.md`): a house is now FireRed's
own house inside, a Poké Mart is FireRed's Poké Mart, and a house can have a
floor above it.

The art is cut from pret's FireRed disassembly by `scripts/cut-frlg-areas.mjs`
(provenance in `public/assets/ASSET_PROVENANCE.md`). FireRed keeps a room's
floor in a metatile's bottom layer and almost everything standing on it in the
top layer, so the house's furniture is cut clear and stands on any floor of any
style; the Mart's fixtures, a rug and a staircase keep the floor they were drawn
on and are offered only in a room of their own style.

| | |
|---|---|
| `before-play-house.png` | Before: a house was Bill's room from the base, furnished from the base's renders. |
| `play-downstairs.png` | After: FireRed's own player's house downstairs - sink, cupboard, television, window, table and chairs, a plant in each front corner, the mat at the west end under the house's door, and the parquet shaded under the back wall and down the west side as FireRed shades it. |
| `play-upstairs.png` | Up the stairs: FireRed's own upstairs, the bedroom. The way onto a staircase is the little rug beside it, west of a staircase up and east of one down, the same tile on both floors - which is how FireRed's own map data has it. |
| `maker-house.png` | The house in the maker. |
| `maker-furniture.png` | The furniture list, each piece pictured on the room's own floor. |
| `maker-upstairs.png` | ADD AN UPSTAIRS builds the floor above and its stairs; the strip of places gains it. |
| `templates.png` | Every inside a building opens into: the house and its upstairs, the Pokémon Center, the Poké Mart, the gym. |
| `pieces.png` | Every piece of the new sheet, on a checker where it is clear. |

Taken from a `VITE_EPTW_TEST_MODE=pixels` build at 1200x768 by
`tools/playtest/makerAreas.mjs`, which goes in, up the stairs, back down and out
again and checks each step.
