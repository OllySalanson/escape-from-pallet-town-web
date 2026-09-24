# Choosing where to drop in

What to take and where to go were one screen. They are two decisions - one about
your vault, the other about a place - and the second was a pane a third of a
screen wide with four names in it. The loadout is unchanged apart from losing
that pane; where to drop in is its own step between it and the final check
(`DeploymentFlow`, `'loadout' | 'dropin' | 'secure' | 'confirm'`).

## The picture is the screen

The map is drawn as big as the window lets it be - a whole number of game
pixels to the tile, down the whole left of the screen (the screenshots here
show the older 100-pixel banner; `docs/screens/wall-map/` has the current
screen) - and **everything nobody has walked is dark**. That is the point rather than a
compromise: the vast maps are built so you drop in, see a piece and leave
wondering what else is out there, and a full bird's-eye view would hand that
answer over for nothing.

What fills in:

- **the ground you have walked**, kept tile by tile in the save
  (`world/survey.ts`, a bitset per map - a whole Floodplain is under a kilobyte)
  and written once when a raid ends, however it ends;
- **your own landings**, lit whether you have been to them or not, which is what
  makes a fresh save an invitation rather than a black square;
- **the doors you have opened**, derived from `defeatedBosses`, so beating a
  keeper visibly enlarges the map you can look at back at base;
- **the landmarks you have finished with**, derived from `completedContracts`,
  which also turn the exit each of them sealed into one that reads "open for
  good - you finished the landmark" - see `docs/screens/worked-landmarks/`.

The dark is not blank. It is shaded a block of four tiles at a time by what is
mostly in that block - open country lightest, wood and rock darkest, water in a
colour of its own - so the map keeps a coastline and a treeline without giving
away a lane, a door or a clearing. `tools/tileset/minimap.mts` draws the same
picture at any zoom for judging it.

Nothing about the picture is stored or pre-rendered: it is built every frame
from `WorldMapDefinition.terrain` and the collision beside it, in the gate state
this save has earned, so a redrawn map cannot leave a stale image behind.

## What the screen says, and where each line comes from

| | from |
|---|---|
| the description | the insertion's own `description` (`runGeneration.ts`) |
| Grade _n_/4 | the hunter ladder's own rungs, placed by the highest level anything still standing here can field - `HUNTER_TIERS`, the wildlife tables, the trainers `withoutDefeatedBosses` leaves |
| Wild / Fights | the district encounter tables and the authored trainer parties |
| Doors | `WORLD_GATES` against `raidProgress.defeatedBosses` |
| Raids / Known | `raidProgress.raidRecord` and `raidProgress.surveyed`, both new, both defaulting to empty so every accepted save keeps loading |
| ways out | `EXTRACTION_POINTS` and `extractionRequirementText` |
| wildlife | the district's own table - **only for places the survey has reached**, because what lives somewhere you have never been is not something base could tell you |

## Shots

3x of the 400x256 stage (1200x768) and 3x of the smallest stage (960x720, which
is the 320x240 composition every screen is authored against). `dropin-explored`
is the same save after two keepers have been beaten and a third of the
Floodplain walked - the survey in it was written by real raids through
`tools/playtest/raid.mjs --progress=`.

| | 3x | smallest |
|---|---|---|
| the loadout, with the choice of place gone | `loadout-3x.png` | `loadout-small.png` |
| a fresh save: one landing lit, the rest dark | `dropin-fresh-3x.png` | `dropin-fresh-small.png` |
| after two keepers and a third of the map | `dropin-explored-3x.png` | `dropin-explored-small.png` |
| what the place holds, scrolled to the wildlife | `dropin-holds-3x.png` | `dropin-holds-small.png` |
| the final check behind it | `confirm-3x.png` | `confirm-small.png` |

Re-take them with `tools/playtest/dropinShots.mjs`, which refuses to photograph a
screen that puts a scrollbar down the side of the browser.
