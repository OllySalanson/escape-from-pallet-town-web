# TANGLEWOOD, walkable

The captain, 11 November 2026: "I really like the idea of what you've built,
but ... when you're walking around, there's just often things in your way, and
it's quite fiddly to get through places." He asked for the whole vale to be
fixed an area at a time: Millbrook first (`docs/screens/walkable-millbrook/`),
THE HARBOUR and its beach second (`docs/screens/walkable-harbour/`). This is the
third area: **TANGLEWOOD**, the wood east of The Crossing with the hamlet of
Mislaid in it, the shrine, the cavers' camp, the butterfly ride, the Old Oak,
Fuchsia Gym, the Eastern Track and the road on to the Safari Marsh. Nothing
outside Tanglewood was touched.

Everything that made it rich is still there - every person, Pokémon, sign,
berry tree, find, house, prop and broadleaf - moved off the walking lines
rather than taken away. Five cells of the wood were opened, where a door or a
lane met trees: Mislaid's back row, the lane south across the ride, the Bug
Club's yard, the lodge's front and the Old Oak's way on to the windfalls.

## What was in the way, and what moved

Walked in the game by `tools/playtest/walkableVillage.mjs --area=tanglewood`:
19 routes and back from a step into the wood on the road from The Crossing
(`snags-before.json`, `snags-after.json`). **86 snags and 12 walks that never
reached a corner, before; none after, and every walk arrives.** Walked two
abreast over the map (`tanglewood.test.ts`), the old wood was one a pair could
hardly walk at all: from the road in, a pair reached the road and little else.

| Snag (before) | What it was | Now |
|---|---|---|
| The log at the bend in the road | The saw pit's log lay across the road where it turns south, so a pair could not turn the corner | The pit is beside the road where it turns, its log rolled off below it |
| The woodmen's stand | Its stumps, log and crates closed the top of the yard, and the Woodman stood in the way down to the shed | Stacked against the wood either side of a way two wide from the road to the shed door |
| The TANGLEWOOD sign | In the mouth of the lane north to the picnic ground | In a nook beside the junction |
| The picnic ground | Tim, a Caterpie and THE PICNIC GROUND sign stood on the lane down its west side; the pond left a lane a tile wide round its east side to the berry tree | The pond lies against the wood; the picnic is spread on the grass between it and the way across the glade's foot; the berry tree is on the open grass |
| The mushroom ring | The lane from the east ran through the middle of the ring, its Paras on the lane | The ring stands in the glade's south-east, off the lane to the hut and the way down |
| An Oddish | On the lane to the ring | In the corner of the lost picnic |
| Mislaid's back row | The hut's and the cottage's doors opened onto a strip a tile deep, and the lane up from the south met the hut's corner and the MISLAID sign | The back row is a lane two wide; the hut and the cottage stand a tile east, so the lane runs straight up to the street, with a way through between them |
| The yard behind the cottage | Dot stood in the only way up from the street, the well at its head; the postman, the surveyor and the cat filled the yard | The pub stands against the wood (no alley behind it); the well is beside it; the way up is clear and turns into the yard, the people stand round it |
| A statue on the path to the caves | It stood on the worn path from the shrine to the Wood Mouth | The statues stand at the worn ground's corners; the keeper and the pilgrim kneel beside the shrine |
| The WOOD MOUTH sign | In the only two rows to the cave mouth | Beside the path, with the Caver |
| The cavers' camp | The Tea Woman and a Geodude stood in the way down its east side; a broadleaf left the way along its foot a tile wide | The two rows to the mouth, the two along the foot and the two down the east side are clear; the Geodude is among the fallen rocks |
| THE EASTERN TRACK sign | In the way down from the track past the broken cart to the Old Oak | Beside the gym, on the track |
| The broken cart | Its log and the carters closed its glade | Spilled against the wood; the carter at the cart |
| The Old Oak | Its three oaks and the Woodcutter left no way through two wide | The oaks stand either side of the way down from the cart, which runs straight on to the windfalls |
| The halfway stone and the hermit | A Rattata at the way in, a log across it, the DIRECTIONS sign and a Venonat in it | The log is above the hut, the Venonat beside it, the way in clear |
| The butterfly ride | Bug Catcher Tam in the mouth of the lane to it; a Butterfree, a Metapod and the club's sign on its top row; trees across the lane south where it crosses the ride | Tam and the bugs are in the mown middle (Tam still sees across the ride); the lane south runs straight through |
| The Bug Club's door | It opened onto the ride's last row | The club opens onto a mown yard of its own |
| The windfalls | Picker Joss and the windfalls' sign in the lane to the south way out; a tree pinched the way east | Beside the lane; the tree a row down |
| The forester's lodge | A Rattata on the lane past it; the glade entered a tile wide; the door opened onto its last row | Its yard is stacked along the west side, the way down the lodge's wall is two wide, and its front is three rows deep |

## Held by a test

`tools/mapcraft/worlds/greystoneVale/tanglewood.test.ts`: a 2x2 walker - a
lane's width - goes from the road in from The Crossing over the stitched map's
collision, with every figure on every tile of its beat, and must reach every
way out, door, sign, landmark, berry tree, person, trainer and find to within
the one last step a porch is; nothing may stand on the road or the worn paths;
and no way out or door may be further two abreast than the same lanes walked
bare (`bareDistrict`). That last is not Millbrook's measure (against one
walker), because a pair walks a winding wood a step further every time a lane
doubles back. The walk is `walkedTwoAbreast.testkit.ts`, which
`millbrook.test.ts` now asks too. Against the old wood the test names nearly
everything in it.

## Pictures

| Before | After |
|---|---|
| ![the whole wood before](whole-wood-before.png) | ![the whole wood after](whole-wood-after.png) |
| ![what blocks, before](collision-before.png) | ![what blocks, after](collision-after.png) |
| ![the bend in the road and the woodmen's stand, before](road-bend-before.png) | ![after](road-bend-after.png) |
| ![the picnic ground, before](picnic-before.png) | ![after](picnic-after.png) |
| ![the mushroom ring across the lane, before](ring-before.png) | ![the ring beside the lane, after](ring-after.png) |
| ![the lane up into Mislaid, before](mislaid-lane-before.png) | ![after](mislaid-lane-after.png) |
| ![the yard behind Mislaid's cottage, before](mislaid-yard-before.png) | ![after](mislaid-yard-after.png) |
| ![the cavers' camp, before](camp-before.png) | ![after](camp-after.png) |
| ![the broken cart and the way down, before](cart-before.png) | ![after](cart-after.png) |
| ![the Old Oak, before](old-oak-before.png) | ![after](old-oak-after.png) |
| ![the butterfly ride, before](ride-before.png) | ![after](ride-after.png) |
| ![the forester's lodge, before](lodge-before.png) | ![after](lodge-after.png) |

In the collision pictures, red is solid ground that is not wood and blue is a
figure, a trainer and its beat.

## How they were made

- The whole-wood pictures are the district program drawn alone (`mapPicture`
  from `tools/mapcraft/picture.mts`, the old program from `main` before this
  change); the collision ones add the district's own collision and every
  figure's beat over it.
- The in-game pictures are `walkableVillage.mjs --area=tanglewood
  --at=road-bend:10:36,picnic:14:26,ring:12:7,mislaid-lane:30:18,mislaid-yard:41:7,camp:54:19,cart:51:44,old-oak:51:52,ride:27:49,lodge:8:57`
  and the snag lists are `walkableVillage.mjs --area=tanglewood`, both against
  two test-mode builds (`VITE_EPTW_TEST_MODE=1 npx vite build`), one with the old
  `greystoneVale.json` and one with the new, served under
  `/escape-from-pallet-town-web/` and driven in headless Chromium at
  `PIXEL_WINDOW`, by day, on the explorer run.
