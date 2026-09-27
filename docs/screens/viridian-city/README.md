# Viridian City

A fifth raid map: Viridian City and the three roads out of it, 72x76, drawn
on Kanto's own FireRed art (`public/assets/frlg-kanto.png`, cut for it by
`scripts/cut-frlg-kanto.mjs`) and held to the FireRed standard the map-making
plan proposed rather than to the nine-step rule the other four maps were bent
to. It is played like any other map: a front door in the square, three more
landings, six ways out, a keeper with two doors, a Cut tree, three prizes.

![The whole map, drawn by the game's own layer builder](map.png)

## How to use it

**Quickest - the explorer run.** On the title screen choose **PLAYTEST**. In
the harbour walk into **Oak's Lab**, speak to Oak, **Start a raid**, pick the
team, **Choose drop-in** and pick **VIRIDIAN CITY** (the square) - or scroll
for **Forest Gate**, **League Road** or **South Road**. Nobody can knock your
team out, the clock is hours long, every door is open and Gatekeeper Ross is
still standing at his fence to be fought. Hold **Shift** to walk three times
faster and **L** to see every caption on the screen at once.

**In a normal game** Viridian City opens with the first contract, beside the
three small maps. A save that has already banked it gets it on its next load.

Worth walking, in order from the square: the **Pokemon Center** and the
**Mart** (both doors are caches), the **Gym** behind its ledge, north up
**Main Street** past the old man to the **Forest Road** (Bug Catcher Rick
watches where it narrows) and the gatehouse; east to **Diglett's Hill** and
the **Trade House**, whose gate a Cut tree has grown across; west to the
**League Road**, Camper Liam, and **Gatekeeper Ross** at the League fence -
the forecourt and the League gate are behind him; south-west through the
**Border Fields** to the **Ranger's Hut**, whose lockbox opens Diglett's Cave
on the far side of the map; and down the **South Terraces** by the ledges to
the Pallet Road.

## Why a new map rather than a rebuild

- **The four shipped maps fail the standard by construction, not by detail.**
  Measured below with the plan's own definitions: held direction median 1-2
  steps, no run over 9, 10-19% one-tile lanes, 18-431 tall-grass patches down
  to single tiles. Every one of those comes from the lattice-of-big-trees
  method and the nine-step rule, so fixing one map means redrawing it, and
  redrawing the four is the captain's open decision (D6), not this one.
- **A rebuild moves learned routes.** Each shipped map pins dozens of route
  facts in its own test (`palletTown.test.ts`, `route1.test.ts`, ...); the
  plan lists "learned routes change" as the first risk of a redraw. A new map
  moves nobody's routes and can be judged side by side with the old ones.
- **The art had to be cut anyway.** The FireRed ground sheet has one
  building and no route conifer, so any map that looks like Kanto needed
  Kanto's houses, fences, paving and trees cut first - and a town is where
  those show.
- **Viridian City is the gap in the geography.** Route 1 and Viridian Forest
  are in the game; the town between them was not.

## What makes a good map: the research, briefly

Sources, read in full: the map-making plan and the three earlier map reports;
pret/pokefirered's own collision for fourteen FireRed maps; Satoshi Tajiri's
1996 interview; the Bulbapedia pages for Viridian City, Viridian Forest,
Routes 3, 22 and 24, ledges, Cut and trainers; the PokeCommunity mapping
tutorials for routes and cities; Kev Marshalkowski's three-part analysis of
A Link to the Past's Light World, and Zelda Wiki on Kakariko; The Minish Cap
retrospectives; the Stardew Valley wiki on Pelican Town, the Secret Woods and
the Quarry; the Level Design Book (wayfinding, composition, critical path,
typology, gates, pacing); Taylor's ten principles, Totten on prospect and
refuge, Sutton on weenies; Crytek, PC Gamer, Kotaku and GamesRadar+ on Hunt,
Arc Raiders and Escape from Tarkov.

What they agree on, as twelve rules this map was drawn and scored to:

1. **One barrier language** - tree is wall, fence is a wall with a gate
   somewhere, ledge is a one-way drop, a Cut tree or a keeper is a keyed door.
2. **Land first, settlement second** - every building is somewhere a person
   would put it (Hunt: "compounds grow up naturally around those features").
3. **One useful silhouette per district** - a player dropped anywhere can
   name the place from the screen, and its landmark is something they need.
4. **A hub with distinct spokes** - FireRed's Viridian has "three exits";
   Pelican Town has four edges; each goes somewhere different.
5. **Width is a promise** - lanes stay steady and narrow to one tile only for
   a toll, a gate or an exit ("We're not making a maze").
6. **Every route has a visible price** - grass or a trainer, shown before
   the step.
7. **Doors only where they lead; secrets only with a tell** - filler houses
   have no door, and every hidden pocket has somebody or something saying so.
8. **Show the lock before the key.**
9. **Unlocks close loops** - an opened door shortens an old walk or closes a
   ring; ledges are "one-way shortcuts home".
10. **No deep dead ends on a hunted map** - short ones that pay out only.
11. **Alternate prospect and refuge, and put the prize in the prospect.**
12. **Spread exits by direction, distance and noise** - some quiet or
    conditional, and the open set changes during the raid.

## The plan, coarse first

A crossroads town, drawn the way FireRed's is: the town is paved, fast and
bare, and the price is on the roads out of it.

| Spoke | Road | What it costs | Where it ends |
|---|---|---|---|
| North | THE FOREST ROAD (Route 2) | Bug Catcher Rick where it narrows, or the grass beds round him | the FOREST GATE, always open; the high path west to the forecourt's side gate |
| West | THE LEAGUE ROAD (Route 22) | Camper Liam by the pond, or the pond grass | Gatekeeper Ross at the LEAGUE FENCE; the forecourt and the LEAGUE GATE behind him |
| South | THE SOUTH TERRACES (Route 1) | Lass Ada on the terrace road, or the grass beds; going down is three ledges | the PALLET ROAD, always open |
| East | THE EAST WOOD | a grass bed across the clearing | the EAST TRAIL, always open - the quiet way out |
| South-west | THE BORDER FIELDS | long grass full of Nidoran | the WEST STILE at 1:30, and the Ranger's Hut, whose lockbox opens DIGLETT'S CAVE in the far north-east |

Fifteen districts, each holding the thing its name says: THE FRONT GATE,
DIGLETT'S HILL, THE TRADE HOUSE, THE FOREST ROAD, THE LEAGUE ROAD, THE BORDER
FIELDS, THE ACADEMY, THE GYM, MAIN STREET, CENTER SQUARE, THE POND, GARDEN
ROW, THE EAST WOOD, THE RANGER'S HUT and THE SOUTH TERRACES.

## Scorecard

Scored against FireRed's own Viridian City, Route 22, Route 2 and Viridian
Forest, Route 24-25 for tolls, Celadon for a town that is its people, and A
Link to the Past's Kakariko for a town hub - after three rounds of in-game
photographs and a pass of this table, which found two of the fixes itself.

| # | Rule | Check | Result |
|---|---|---|---|
| 1 | One barrier language | each blocking material means one thing | **Pass.** Conifers are walls and never have a gap; fences ring the town's yards with gaps where the way in is; the one keyed fence is a keeper's and the one keyed gap is a Cut tree, drawn as the small tree FireRed uses. Round bushes cap ledges and flank doors, as in FireRed. |
| 2 | Land first | would somebody build this here | **Pass.** A town on a crossroads; the Gym and the League road at the north-west, the Center and Mart in the square, houses along Garden Row, the ranger out in the meadows, a trade house on the hill by the cave. |
| 3 | A silhouette per district | name the place from the screen | **Pass.** Every district has a building or landform nobody else has: League gate, gatehouse, rock and cave, fenced cottage, pond and rock, stile and fields, school, Gym, Center and Mart, town pond, window boxes, clearing, blue hut and flowers, terraces. |
| 4 | Hub with distinct spokes | each direction a different kind of place | **Pass.** Wood and gatehouse north, League road and keeper west, terraces south, wood trail east - FireRed's three exits plus a quiet fourth. |
| 5 | Width is a promise | every one-tile neck has a reason | **Pass.** 3% of the ground is one-tile lane (FireRed's Viridian: 4%). The necks are ledge landings, the exit pockets and the alley behind the last house on Garden Row, which is the way to the potting shed and is told of. |
| 6 | Every route has a price | grass or a trainer, before the step | **Pass**, once this table was scored: the East Trail was free and the square's nearest exit, and now crosses a grass bed. |
| 7 | Doors lead; secrets have tells | | **Pass.** Seven doorways, every one a cache or an exit; filler houses are shut. The potting shed, the Moon Stone and the trade house each have somebody saying so. |
| 8 | Lock before key | a fresh save sees what it cannot reach | **Pass.** The League gate is in sight through the fence, the trade house through its railings, the cave's sealed mouth captions the lockbox that opens it. |
| 9 | Unlocks close loops | | **Pass.** Beating Ross opens both his doors and makes the forecourt a ring between the League road and the Forest road; the lockbox opens a far-corner exit; seven ledges are one-way shortcuts south. The Cut tree opens a place, not a short cut (`fieldMoves.test.ts`). |
| 10 | No deep dead ends | | **Pass.** The one-tile dead-end arms left are ledge landings, which is FireRed's own shape for them; the one that was not - a six-tile alley along the trade house fence - is planted over. |
| 11 | Prospect and refuge | the prize is exposed | **Pass.** The Moon Stone is in the open fields, the Ranger pack in the forecourt behind the keeper, the Raid pack in the ranger's meadow. |
| 12 | Exits spread | direction, distance, noise | **Pass.** Six exits on six bearings: two always open at the map's ends, one quiet one east, one behind a keeper, one timed, one opened by a landmark on the far side of the map. |

Against the benchmarks directly:

- **FireRed Viridian City.** Measured on the plan's definitions it is
  FireRed's own numbers (table below). Its buildings, fences, paving, sign
  and trees are FireRed's own tiles, used the way the town uses them.
- **Route 22 and Route 2.** Ledges above the road, a trainer on the lane, a
  grass bed for the way round, a gatehouse at the end; a keeper where Route
  22's gate is.
- **Viridian Forest.** Its dead ends pay out; so do these (the potting shed,
  the first-aid box, the bird hide).
- **Route 24-25.** A toll you can see coming: every trainer is captioned and
  shaded before the step, and every one has a grass way round.
- **Celadon.** A town is its people: eighteen townspeople, each where their
  business is, and every one of them says where something is.
- **Kakariko.** A hub the world is laid out around, and a town that changes
  state: the forecourt ring opens once the keeper is beaten.

## Measured

**The FireRed standard** (the plan's Appendix B definitions; FireRed rows from
its section 3.1):

| Map | Size | Held median | Held > 9 | Longest walk | One-tile lanes | Grass patches | Smallest | Wall crumbs /1000 | Furthest from wall |
|---|---|---|---|---|---|---|---|---|---|
| FireRed Viridian City | 48x40 | 4 | 29% | 39 | 4% | 0 | - | 1.6 | 5 |
| FireRed Route 1 | 24x40 | 4 | 22% | 19 | 3% | 6 | 10 | 0 | 5 |
| FireRed Viridian Forest | 54x69 | 5 | 33% | 47 | 0% | 7 | 49 | 1.3 | 4 |
| **Viridian City** | **72x76** | **4** | **24%** | **37** | **3%** | **11** | **12** | **1.8** | **5** |
| Pallet Town | 64x76 | 2 | 0% | 9 | 10% | 116 | 1 | 4.9 | 2 |
| Route 1 | 64x72 | 1 | 0% | 9 | 16% | 18 | 1 | 15.2 | 2 |
| Viridian Forest | 64x72 | 1 | 0% | 9 | 16% | 81 | 1 | 4.3 | 2 |
| Floodplain Relay | 128x128 | 1 | 0% | 9 | 19% | 431 | 1 | 11.0 | 2 |

**Density** (`tools/tileset/density.mts`, steps from any tile to the nearest
permanent authored thing): Viridian City **5.0** mean, worst 16, against
Pallet Town 4.7, Route 1 5.7, the Floodplain 7.4 and Viridian Forest 7.5. The
first draft was 8.7 with a worst of 36, and it was answered with places and
people rather than notices: the bird hide, the potting shed, the ranger's
first-aid box, the notice board in the square, and thirteen townspeople each
standing where their business is.

**The keeper and the tolls** (`tools/trainers/report.mts`, over the real
engine). Gatekeeper Ross's first party - Mankey, Spearow, Nidorino, Route 22
to the letter - was a starter lottery: both resist Vine Whip, and a Bulbasaur
at 14 won 1% against a Charmander's 85%. He fields Mankey 10, Diglett 11 (out
of the cave on his own hill) and Rattata 11 now: a 66% rung, with every
starter at 14 between 52% and 72%, which is where the small maps' doors sit,
and he is on `trainerLadder.test.ts`. The three tolls are what the other
maps' tolls are: 0-20% for a level-5 starter with nothing packed, 80-100% at
level 10.

**Getting out.** From the square the East Trail is 33 steps and the Forest
Gate 51; the Forest Gate and South Road landings are 2 and 3 steps from their
own gates; the League Road landing is 27 steps from the West Stile once it
opens at 1:30 and 78 from the nearest gate open at the start. The raid clock
is unchanged.

## What the photographs changed

Three rounds of the real game at 3x (`tools/playtest/tour.mjs`), each shot
read before the next change. The two below were found in a photograph and
nowhere else.

| before | after |
|---|---|
| ![](behind-the-hut-before.png) | ![](behind-the-hut-after.png) |

**Behind a roof, a figure was a head.** FireRed lets you walk along the back
of a house with the eave drawn over you; here that left the player behind the
ranger's hut as a head and a chevron, the thing `crowns.test.ts` refuses of
a tree. A roof's top row is a wall now.

| before | after |
|---|---|
| ![](old-man-before.png) | ![](old-man-after.png) |

**Nothing stands under a conifer's tip.** The tip is drawn over whoever
stands on the row above a tree, which is FireRed and fine for somebody
walking past, but the old man stood on one and was a pair of shoulders
growing out of a tree, and so were a sign and a Radio Valve. Authored things
are held off canopy by `crowns.test.ts`, and loot and seated trainers never
land there (`runGeneration.ts`).

Also found and fixed: a fence's free end drew FireRed's corner post, a second
post standing out in the yard; Route 22's east rail and the Gym each carried
a few pixels of the grass they were ripped standing on, which showed as green
crumbs on paving (both keyed out, and `kantoSheet.test.ts` holds it); a
Diglett's Hill alley went nowhere; the East Trail was free; the Trade House's
Cut tree stood in a fence end rather than a fence run; a one-tile strip beside
a garden house was a dead end nobody would walk into.

## The rest

| | |
|---|---|
| ![](center-square.png) | ![](gym.png) |
| CENTER SQUARE - the front door, Joy's night hatch, the Mart | THE GYM behind its ledge, the guide and a hopeful |
| ![](forest-gate.png) | ![](league-fence.png) |
| THE FOREST ROAD's gatehouse, a landing and a way out | GATEKEEPER ROSS at the League fence, the forecourt behind |
| ![](diglett-hill.png) | ![](east-wood.png) |
| DIGLETT'S HILL, the sealed cave and the Trade House's Cut tree | THE EAST WOOD - the woodcutter's store, the grass bed, the East Trail |
| ![](south-terraces.png) | ![](ranger-hut.png) |
| THE SOUTH TERRACES - ledges down, Lass Ada watching the road | THE RANGER'S HUT - the lockbox and the first-aid box |
| ![](academy-pond.png) | ![](garden-row.png) |
| THE ACADEMY and THE POND | GARDEN ROW and the city sign at the foot of Main Street |
| ![](border-fields.png) | ![](drop-in.png) |
| THE BORDER FIELDS - the farmer, the West Stile | The drop-in screen |
| ![](wall-map.png) | ![](wall-map-close-up.png) |
| The wall map in Oak's Lab, five maps now | Viridian City close up |

`drop-in-smallest.png` is the drop-in step at the 320x240 stage.

## Known limits

- **The standard is this map's alone.** `mapStructure.testkit.ts` holds
  Viridian City to the FireRed standard (no tile more than five steps from a
  wall, held direction median 2-5, longest walk 47) and the other four to the
  nine-step rule they were drawn to. Moving them is the redraw the captain has
  not decided on.
- **Houses have no insides.** A filler house has no door, as in FireRed; the
  seven doorways are caches and exits.
- **The League Road landing** is 78 steps from a gate open at the start - the
  longest of any landing here, and still under a twentieth of the clock.
