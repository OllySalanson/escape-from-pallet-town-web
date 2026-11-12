# HIGH MOOR, walkable

The captain, 11 November 2026: "I really like the idea of what you've built,
but ... when you're walking around, there's just often things in your way, and
it's quite fiddly to get through places." He asked for the whole vale to be
fixed an area at a time: Millbrook (`docs/screens/walkable-millbrook/`), THE
HARBOUR (`walkable-harbour/`), TANGLEWOOD (`walkable-tanglewood/`), PINE HOLLOW
(`walkable-pine-hollow/`) and THE CROSSING (`walkable-the-crossing/`) came
first. This is the sixth area: **HIGH MOOR**, the drove road north out of Mill
Square - the Moor Foot and its waystones, the ledges, the tarn, Moor Top, the
drovers' fold and camp in the heather, the Grey Stones and the Little Stones,
the Moor Gate and its toll house, the trail east past Moor Spring, the
shepherd's clearing to the west, and THE LOST FOLD behind its boulder. Nothing
outside High Moor was touched.

Everything that made it rich is still there - every person, Pokémon, trainer,
berry tree, find, sign and prop - moved off the walking lines rather than taken
away. One thing was added: a buttress of the tor out to the road.

## What was in the way, and what moved

Walked in the game by `tools/playtest/walkableVillage.mjs --area=high-moor`:
14 routes and back from a step up the drove road from Millbrook
(`snags-before.json`, `snags-after.json`). **11 snags and 2 walks that never
arrived, before; none after.** The moor's road is wide, so most of what was
wrong was off it, where a pair goes to a door, a person or a find - which is
what `highMoor.test.ts` walks.

| Snag (before) | What it was | Now |
|---|---|---|
| The toll house's step | A barrel on the path to the door and the Toll Clerk beside it: the door could not be reached two abreast | The barrel stands by the bench; the clerk paces the yard's edge |
| The Little Stones | Three stones, two Clefairy and Mother Stone filled the ring, a stone on the road, and the sign beyond them could not be reached | The stones stand round the ring's edge with the clearing open between them, the Clefairy and Mother Stone at its sides; the eleventh stone's Alakazam (#534, which landed after these pictures were taken) sits in the ring's north-east corner above the notice, clear of the way across the ring and of the cut to the Lost Fold |
| The drovers' camp | A log lay across the hut's door | The log is stacked behind the hut |
| Moor Spring | The Attendant stood on the bath hut's step, and the spring's marker on the trail | He stands beside the step; the spring is marked on the pool's bank |
| The drovers' fold and the Moor Foot's pen | Gates one tile wide | Gates two wide |
| The corner below the fold | The Herd Girl and Drover Hale stood on the heather where the road turns, and the fold's sign on the road | Hale stands out on the heather; the Herd Girl counts the herd from outside her fold's fence, by its sign, which is beside the road |
| The halfway rest and the tarn | The log, a stump, the Walker and the tarn's Psyduck stood on the straight way up the lawn inside the road's bend | The log and stump are by the bench with the Walker; the Psyduck is in the reeds below the tarn, and the halfway rest's Spearow is up on Moor Top's corner so the knoll still has somebody on it |
| The tor's foot | The lawn between the tor and the road was a lane two wide with the tor's sign, its clue, the Drover's Wife and a Geodude in it | A buttress of the tor reaches the road, so the lawn is two bays off it: the sign and the Wife in one, the clue and the Geodude in the other |
| The waystones | A waystone shut a find in behind it, and a stump stood on the straight way to Lina | The stone stands a row higher and the stump is by the wood |
| The shepherd's sign | On the road | Beside it |
| THE LOST FOLD | Once the boulder was moved, its sign and berry tree stood across the way in, and a broadleaf, a log and the old bull across the middle | The sign and the sitrus tree are against the wood, the broadleaf is in the fold's lower corner, and the way along the fold is clear to the hut, the shieling and Old Hob |

## Held by a test

`tools/mapcraft/worlds/greystoneVale/highMoor.test.ts`: a 2x2 walker - a
road's width - goes from the drove road up from Millbrook over the stitched
map's collision, with every figure on every tile of its beat, and must reach
every way out, door, sign, landmark, berry tree, person, trainer and find to
within the one last step a porch is, and Moor Top; nothing may stand on a road;
and no way out or door may be further two abreast than the same ground walked
bare - which on a winding road is the lawn inside each bend. THE LOST FOLD is
behind a boulder in a cut one tile high, narrow on purpose as Millbrook's Cut
garden is, so it is walked on its own from the cut's far end and held to the
same rule inside. Against the old moor four of its five checks fail.

## Pictures

| Before | After |
|---|---|
| ![the whole moor before](whole-moor-before.png) | ![the whole moor after](whole-moor-after.png) |
| ![what blocks, before](collision-before.png) | ![what blocks, after](collision-after.png) |
| ![the toll house, before](toll-house-before.png) | ![after](toll-house-after.png) |
| ![the Little Stones, before](little-stones-before.png) | ![after](little-stones-after.png) |
| ![the tor's foot, before](tor-before.png) | ![after](tor-after.png) |
| ![the drovers' camp, before](camp-before.png) | ![after](camp-after.png) |
| ![the drovers' fold, before](fold-before.png) | ![after](fold-after.png) |
| ![Moor Spring, before](spring-before.png) | ![after](spring-after.png) |
| ![the halfway rest, before](halfway-before.png) | ![after](halfway-after.png) |
| ![the waystones, before](waystones-before.png) | ![after](waystones-after.png) |
| ![the Moor Foot's pen, before](moor-foot-before.png) | ![after](moor-foot-after.png) |
| ![THE LOST FOLD, before](lost-fold-before.png) | ![after](lost-fold-after.png) |

In the collision pictures, red is solid ground that is not wood or water and
blue is a figure, a trainer, a sign, a berry tree or a landmark, and every tile
of a figure's beat.

## How they were made

- The whole-moor pictures are the district program drawn alone (`mapPicture`
  from `tools/mapcraft/picture.mts`, the old program from `main` before this
  change); the collision ones add the stitched map's collision with every gate
  open, and every figure's beat, over it.
- The in-game pictures are `walkableVillage.mjs --area=high-moor
  --at=toll-house:26:11,little-stones:34:11,tor:33:17,camp:34:27,fold:26:29,spring:54:37,halfway:26:47,waystones:27:58,moor-foot:32:59,lost-fold:46:12`
  and the snag lists are `walkableVillage.mjs --area=high-moor`, both against two
  test-mode builds (`VITE_EPTW_TEST_MODE=1 npx vite build`), one with the old
  `greystoneVale.json` and one with the new, each served under
  `/escape-from-pallet-town-web/` on a port of its own and driven in headless
  Chromium at `PIXEL_WINDOW`, by day, on the explorer run.
