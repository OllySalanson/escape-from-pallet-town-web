# PINE HOLLOW, walkable

The captain, 11 November 2026: "I really like the idea of what you've built,
but ... when you're walking around, there's just often things in your way, and
it's quite fiddly to get through places." He asked for the whole vale to be
fixed an area at a time: Millbrook first (`docs/screens/walkable-millbrook/`),
THE HARBOUR and its beach second (`docs/screens/walkable-harbour/`), TANGLEWOOD
third (`docs/screens/walkable-tanglewood/`). This is the fourth area: **PINE
HOLLOW**, the dark pine wood north of Tanglewood - the trail in over the col
from Greystone Peaks, the Cold Spring, the tappers' camp and the weeping pine in
the hollow, the oak, the Pikachu glade, THE BEE WOOD and the deer path down to
Tanglewood. Nothing outside Pine Hollow was touched.

Everything that made it rich is still there - every person, Pokémon, trainer,
berry tree, find, hut and prop - moved off the walking lines rather than taken
away. One cell of pines was opened: the three trees between the col's rest and
the trail's bend, so the rest is a clearing rather than a strip one cell deep.

The wood is drawn on the conifer lattice, so every lane in it is exactly two
tiles wide. That is why it was so fiddly: one thing standing in a lane closes it
to a pair, and most of what was in the way was a single thing in a lane.

## What was in the way, and what moved

Walked in the game by `tools/playtest/walkableVillage.mjs --area=pine-hollow`:
13 routes and back from a step in on the trail over the col
(`snags-before.json`, `snags-after.json`). **66 snags before; none after, and
every walk arrives both times.** Walked two abreast over the map
(`pineHollow.test.ts`), the old wood was one a pair could not get into at all:
from the col, a pair got no further than the trail either side of it.

| Snag (before) | What it was | Now |
|---|---|---|
| The chesto tree on the trail | It stood on the trail where it climbs north from the col, so every walk into the wood met it, and a pair could not pass at all | Beside the trail, at the corner of the col's rest |
| The col's rest | The log, the stump, the Col Walker and a Spearow filled a strip one cell deep beside the trail | The three pines behind it are gone, and it is a clearing three cells deep with the log and the stump along its foot |
| The charcoal nook | A dead stump stood in the mouth of the lane down into it | At the nook's far corner, where the stack burnt out |
| The spring | A Psyduck walked the only way up past the pond; a stump stood in the way round its far side | The Psyduck paddles at the pond's edge; the stump is against the pines |
| The hollow's floor | The tappers' big stump and log and the Amber Hunter lay across the floor between the trail's foot and the climb out east | The stump is in the floor's east corner and the log is stacked with the rocks in the hollow's; the Amber Hunter stands below the weeping pine, looking at it |
| The tappers' camp | The pots closed the way up beside the lean-to to the Sunday's find; the Resin Tapper paced the lean-to's doorstep | The upturned pot is at the back by the find, the other at the head of the alley; the Tapper works the yard's foot |
| The deer path | A stump across the way from the hollow into the tall grass, a Caterpie in it, a Nidoran♀ pacing the bend, Nidoran♂ and Metapod in the lane down | The stump and the Caterpie are in the grass's corners, the Deer Stalker and the Nidoran♀ sit by the log, and the lane down is clear |
| The bee wood | The nest stood at the foot of the lane down into it, the Snorlax and the Woodsman across the back of the glade | The lane runs straight on to the back of the glade; the nest is in the glade, the bees round it and the Bee Warden facing it; the Snorlax sleeps at the back of the glade beside the lane's foot, the Woodsman watching him from across it |
| The way into the Pikachu glade | A Pikachu stood in it | On the open grass beside it |
| The Pikachu glade | A Pikachu on the way along its top to the Fox Run; the posts, crates, Linesman and Oddish left the way down it one tile wide | The way to the Fox Run is clear; the cable's posts are in the glade's middle with the Linesman between them, the crates against the trees |
| The oak | A Vulpix paced the way up from the road to the pecha tree; Collier Bram and his mate stood on the ground worn bare under the oak, Bram on the way up to where the card was dropped | The Vulpix is in the glade's west corner; Bram and his mate sit under the oak, and Bram's eye is on the worn ground as before, not on the way up |

## Held by a test

`tools/mapcraft/worlds/greystoneVale/pineHollow.test.ts`: a 2x2 walker - a
lane's width - goes from the trail in over the col over the stitched map's
collision, with every figure on every tile of its beat, and must reach every way
out, door, landmark, berry tree, person, trainer and find to within the one last
step a porch is; nothing may stand on the trail or the worn ground except the
weeping pine and its pots, which stand on the floor the tappers have worn bare
round it; and no way out or door may be further two abreast than the same lanes
walked bare. Against the old wood it names nearly everything in it.

## Pictures

| Before | After |
|---|---|
| ![the whole wood before](whole-wood-before.png) | ![the whole wood after](whole-wood-after.png) |
| ![what blocks, before](collision-before.png) | ![what blocks, after](collision-after.png) |
| ![the col's rest and the chesto tree on the trail, before](col-before.png) | ![after](col-after.png) |
| ![the spring, before](spring-before.png) | ![after](spring-after.png) |
| ![the charcoal nook, before](charcoal-before.png) | ![after](charcoal-after.png) |
| ![the tappers' camp, before](camp-before.png) | ![after](camp-after.png) |
| ![the hollow's floor, before](hollow-floor-before.png) | ![after](hollow-floor-after.png) |
| ![the deer path into the grass, before](deer-path-before.png) | ![after](deer-path-after.png) |
| ![the deer path's bend, before](deer-bend-before.png) | ![after](deer-bend-after.png) |
| ![the bee wood, before](bee-wood-before.png) | ![after](bee-wood-after.png) |
| ![the Pikachu glade, before](pikachu-glade-before.png) | ![after](pikachu-glade-after.png) |
| ![the oak, before](oak-before.png) | ![after](oak-after.png) |

In the collision pictures, red is solid ground that is not wood and blue is a
figure, a trainer, a berry tree or a landmark, and every tile of a figure's beat.

## How they were made

- The whole-wood pictures are the district program drawn alone (`mapPicture`
  from `tools/mapcraft/picture.mts`, the old program from `main` before this
  change); the collision ones add the district's own collision and every
  figure's beat over it.
- The in-game pictures are `walkableVillage.mjs --area=pine-hollow
  --at=col:10:19,spring:21:10,camp:32:27,hollow-floor:40:31,deer-path:21:43,deer-bend:12:52,bee-wood:33:53,pikachu-glade:53:43,oak:55:20,charcoal:9:32`
  and the snag lists are `walkableVillage.mjs --area=pine-hollow`, both against
  two test-mode builds (`VITE_EPTW_TEST_MODE=1 npx vite build`), one with the old
  `greystoneVale.json` and one with the new, each served under
  `/escape-from-pallet-town-web/` on a port of its own (one port for both lets
  the browser keep the first build's files) and driven in headless Chromium at
  `PIXEL_WINDOW`, by day, on the explorer run.
