# THE CROSSING, walkable

The captain, 11 November 2026: "I really like the idea of what you've built,
but ... when you're walking around, there's just often things in your way, and
it's quite fiddly to get through places." He asked for the whole vale to be
fixed an area at a time: Millbrook first (`docs/screens/walkable-millbrook/`),
THE HARBOUR second (`docs/screens/walkable-harbour/`), TANGLEWOOD third
(`docs/screens/walkable-tanglewood/`), PINE HOLLOW fourth
(`docs/screens/walkable-pine-hollow/`). This is the fifth area: **THE
CROSSING**, the river valley east of Millbrook - the road in from the village,
the stone bridge into BRIDGE END and its square, the stone yard and the anglers'
stage up the road to the peaks, the drovers' rest and the bee garden on the
Tanglewood road, the heron walk, the eel weir, the stepping stones and the
charcoal burners on the road nobody signs. Nothing outside The Crossing was
touched.

It was taken fifth because it is the one every player walks next: the road east
out of Millbrook comes over its bridge, and Tanglewood and Pine Hollow, already
done, are reached through it. `tools/mapcraft/worlds/greystoneVale/twoAbreastTable.mts`
measures every district the same way and is how the next one is chosen.

Everything that made it rich is still there - every person, Pokémon, trainer,
berry tree, find, stall, hut and prop - moved off the walking lines rather than
taken away. Two pines were opened: the pair that shut the Stepping Stones
landing into a pocket.

## What was in the way, and what moved

Walked in the game by `tools/playtest/walkableVillage.mjs --area=the-crossing`:
19 routes and back from a step in on the road from Millbrook
(`snags-before.json`, `snags-after.json`). **103 snags and 20 walks that never
arrived, before; none after.** Walked two abreast over the map
(`theCrossing.test.ts`), the old valley could not be crossed at all: a pair got
over the bridge and no further, so the whole east bank - Bridge End's square,
the toll house, the Tanglewood road, the bee garden, the drovers' rest - was out
of reach.

| Snag (before) | What it was | Now |
|---|---|---|
| The east end of the bridge | The Toll Keeper stood on the street where it comes off the bridge, Pip's Aunt and a Pidgey beside him, the fountain in the middle of the street, the Lad, another Pidgey and the Meowth across the rest of it | The street is clear its whole width from the bridge to the Tanglewood road. The fountain stands in a niche at the head of the square, at the foot of the road down from the peaks; the Toll Keeper and Pip's Aunt stand on the kerb by the inn, the Lad and the Pidgey among the stalls, the Meowth by the toll house |
| The toll house's step | Planters, a sack and the town map round the door, and no way to it two abreast | The planters are along the house front beside the town map, with the door's step clear |
| The cheri tree | In a one-tile gap between a broadleaf and the pines | The broadleaf stands a tile west, and the way up to the tree is two wide |
| The road down from the peaks | The masons' shed stood on its bottom row, and a Spearow on the road below the bend | The shed stands a row lower with its yard in front; the Spearow is on the grass beside the road |
| The stone yard's find | Behind the boulder, the rocks, the Stone Carter and Breaker Dunn | By the boulder at the road's bend |
| The drovers' rest | Its gate opened onto a tree, a Doduo pacing the gateway | The tree is in the yard's back corner and the Doduo by the tauros; the Ponyta paces along the back rather than in front of the find |
| The bee garden | Tall bushes, the Beekeeper and a Weedle left aisles one tile wide, a pot plant across the open south side by the hut's door | Two-wide aisles from the gate and down both sides of the hut; the bushes, the pot plant and the bees are against the fences |
| The sign on the road from Millbrook | THE CROSSING's sign stood on the road | Beside it |
| Netter Bryn | On the road south, by the heron walk | Beside it, with the heron walk still his spot |
| The burners' bend | A big stump on the bend of the road south, a log on the road, a log shutting Collier Osk in | The stump is behind the shed, the logs along the trees in the burners' clearing and beside the road |
| The road south to Gull Strand | A big stump, a log and the sign across it | The stump and log are in the burners' clearing; the sign stands beside the road |
| The Stepping Stones landing | Two pines and the heron hide's marker shut it in a pocket a pair could not walk out of | The two pines are gone, and the landing is a clearing off the road. It stands in the clearing's east corner under the end of a log, so a direction held on landing is answered at once: with the pines gone, every tile of the clearing looked straight up the Wide Water road, 27 tiles |

## Held by a test

`tools/mapcraft/worlds/greystoneVale/theCrossing.test.ts`: a 2x2 walker - a
road's width - goes from the road in from Millbrook over the stitched map's
collision, with every figure on every tile of its beat, and must reach every way
out, door, sign, landmark, berry tree, person, trainer and find to within the
one last step a porch is, and the Stepping Stones landing; nothing may stand on a
road; no way out or door may be further two abreast than the same ground walked
bare; and Bridge End's crossing, from the bridge to where the Tanglewood road
begins, must be clear tile by tile. Against the old valley every one of its
checks fails.

## Pictures

| Before | After |
|---|---|
| ![the whole valley before](whole-valley-before.png) | ![the whole valley after](whole-valley-after.png) |
| ![what blocks, before](collision-before.png) | ![what blocks, after](collision-after.png) |
| ![off the bridge into Bridge End, before](bridge-end-before.png) | ![after](bridge-end-after.png) |
| ![Bridge End's square, before](square-before.png) | ![after](square-after.png) |
| ![the stone yard, before](stone-yard-before.png) | ![after](stone-yard-after.png) |
| ![the drovers' rest, before](drovers-before.png) | ![after](drovers-after.png) |
| ![the bee garden, before](bee-garden-before.png) | ![after](bee-garden-after.png) |
| ![the burners' bend, before](burners-bend-before.png) | ![after](burners-bend-after.png) |
| ![the road south, before](strand-road-before.png) | ![after](strand-road-after.png) |
| ![the Stepping Stones, before](stepping-stones-before.png) | ![after](stepping-stones-after.png) |

In the collision pictures, red is solid ground that is not wood or water and
blue is a figure, a trainer, a sign, a berry tree or a landmark, and every tile
of a figure's beat.

## How they were made

- The whole-valley pictures are the district program drawn alone (`mapPicture`
  from `tools/mapcraft/picture.mts`, the old program from `main` before this
  change); the collision ones add the stitched map's collision with every gate
  open, and every figure's beat, over it.
- The in-game pictures are `walkableVillage.mjs --area=the-crossing
  --at=bridge-end:29:31,square:42:31,stone-yard:41:9,drovers:55:28,bee-garden:50:40,burners-bend:47:50,strand-road:47:55,stepping-stones:39:54`
  and the snag lists are `walkableVillage.mjs --area=the-crossing`, both against
  two test-mode builds (`VITE_EPTW_TEST_MODE=1 npx vite build`), one with the old
  `greystoneVale.json` and one with the new, each served under
  `/escape-from-pallet-town-web/` on a port of its own and driven in headless
  Chromium at `PIXEL_WINDOW`, by day, on the explorer run.
