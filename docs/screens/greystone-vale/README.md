# Greystone Vale

A new raid map, planned coarse and drawn one district at a time with
`tools/mapcraft` (its source is `tools/mapcraft/worlds/greystoneVale/`). This
is the plan, each district that is drawn marked DRAWN:

![plan](plan.png)

And the vale as it ships now, with all nine of its districts drawn: Millbrook,
High Moor, Greystone Peaks, Pine Hollow, The Crossing, Tanglewood, Reedmere,
Gull Strand and Orchard Terraces.

![the vale as it ships](vale.png)

![Millbrook](millbrook.png)

Redraw them, and write the map the game ships, with

    npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/worlds/greystoneVale/index.ts out/greystone-vale --write=src/game/world/maps/greystoneVale.json

## Millbrook

The mill village and the vale's front door: every road starts at Mill Square,
and the village is drawn the way a FireRed town is.

- **The square:** you land under the fountain, with planters on either side and
  the market stall below.
- **The Pokémon Center** faces the square's east street.
- **Streets:** a loop runs north-west past the cottages, the allotments and the
  tool shed, and another north-east past the miller's house to the mill, a
  thatched house on the bank of its pond. The south street leaves the square
  and ends at the purple house one way and the Mart's forecourt the other.
- **The foot of the village:** the brook's pool, with reeds round it, and the
  lane south to the marsh runs past it.
- **The frame:** a deep conifer wood closes every side, open only where the
  plan's four roads leave.

It is drawn in FireRed's pieces only: Kanto's buildings, the town pieces cut
from pret, and the FireRed sheet's fountain, stall, planters and signs.

![Millbrook as first drawn](millbrook-first-draw.png)

That is the first draw, which did not pass (below).

## High Moor

The moor above Millbrook, drawn as FireRed draws a route: a corridor twenty
tiles wide between the west wood and the rock of the peaks. The drove road is
three tiles wide, and the land shapes it, so it winds between the big things
the moor holds, one side and then the other:

- the old toll house at the Moor Gate, the way off the map;
- the Grey Stones, a tor;
- the drovers' heather;
- Moor Top, a knoll and a landing, where a rock-walled trail forks east to
  Greystone Peaks past a spring;
- a tarn ringed with reeds;
- a row of ledges at the corridor's foot, the quick way down to the village.

A gap in the west wood opens on the shepherd's cottage and its tarn.

![High Moor](high-moor.png)

It took eight blind rounds, below. This was the first draw, an open moor sixty
tiles wide, which the judges read as empty lawn with props dropped on it:

![High Moor as first drawn](high-moor-round1.png)

## Greystone Peaks

The high ground above The Crossing, drawn as a mountain pass. A pass climbs
from High Moor, through a cutting in a band of rock, past the tarn where the
river is born and round its head. It comes down the far side, squeezed
between the gorge and the cliff the Greystone Caves open in.

- **The two ways:** the climb and the descent are each a corridor about
  eighteen tiles wide, framed by the summit's cliff and the wood on the
  outside and by the gorge between them.
- **The gorge:** the river leaves the tarn and runs south between walls of
  rock to The Crossing.
- **The cave cliff:** one mass with the crag over the quarry. The Greystone
  Caves open at its foot, onto their top floor.
- **The quarry:** an upper bench cut back into the hill, with Breaker Finn,
  the quarry hut and a crate store, and the vale's third landing. A ledge off
  the bench is the quick way back down.
- **Ways on and out:** the pass carries on south to The Crossing, a path
  nobody signs leaves the quarry east into Pine Hollow, and the Goat Track, a
  way out in a nook at the foot of the climb, keeps the west side within the
  hunter's blind window of an exit (`hunterFlee.test.ts`).

![Greystone Peaks](greystone-peaks.png)

Its first judged draw had the river running across open grass between rock
blocks, which both judges called "an arrangement of parts on a lawn":

![Greystone Peaks, round 1's two views](greystone-peaks-round1.png)

## The Crossing

The middle of the vale, where the river is crossed. It is drawn as a valley
about twenty tiles wide between walls of wood, with the river and the road
winding down it:

- **The river** comes down from the peaks under a cliff, with a column of tall
  grass between the cliff and the water, bends once, and opens below the
  bridge into the Wide Water before it carries on south to the strand.
- **The stone bridge** carries the road from Millbrook over the river, past
  the bridge-keeper's cottage, on to Tanglewood. Netter Bryn stands at its east
  end.
- **The trail from the peaks** comes down the east bank, turned by the wood
  where it meets it.
- **The Wide Water:** the Angler fishes it from the west bank.
- **The stepping stones** at the foot of the valley are the second way over:
  a lane through the west wood comes down to them, and past the heron hide on
  the far side a path nobody signs goes on east into Tanglewood. The nook by
  the hide is the vale's fourth landing.

The plan named a ford as a third way over. FireRed has no ford, and its shallow
water drawn into a river read to every judge as a pale square drawn by
mistake, so there is none.

![The Crossing](the-crossing.png)

Its first judged draw, a wide valley:

![The Crossing, round 1's two views](the-crossing-round1.png)

## The vale

Nine districts of 64x64 tiles make a 192x192 map, with room left to grow a
column east and a row south inside a map file's 256x256. Each district has one
idea, which its program is written to:

| District | Terrain | The one idea |
|---|---|---|
| Millbrook | town | The mill village on the brook: a square, the mill race, cottages and the Centre. Every road starts here. |
| High Moor | moor | The old drove road crosses between standing stones and drops south to the village by stacked ledges. |
| Greystone Peaks | mountain | A switchback pass climbs past quarry benches to the mouth of the Greystone Caves; the river is born in a tarn. |
| Pine Hollow | forest | A dark pine wood where one hidden trail threads three clearings; the way south is a deer path nobody signs. |
| The Crossing | river | The river splits the vale; a stone bridge, a ford and stepping stones are three different walks over it. |
| Tanglewood | forest | A broadleaf maze of paths that loop and fork, opening onto a ruined shrine in a glade. |
| Reedmere | marsh | Boardwalks over reed beds round a still mere: tall grass everywhere, and the dry way is the long way. |
| Gull Strand | coast | Sea cliffs where the river meets the sea; a sea cave runs back under the cliffs into the Greystone Caves. |
| Orchard Terraces | farmland | Orchards and pastures step down to the sea; the ledges on the farm road are the quick way home. |

- **Barriers.** The river runs the length of the middle column, so east and west
  meet only at The Crossing's three ways over. The peaks and the sea close the
  north and south.
- **Main routes.** The road from the Westward Road through Millbrook, over the
  river and on into Tanglewood; the drove road down from the moor; and the coast
  road along the strand to the orchards.
- **Hidden forest routes** (dashed): a col from the peaks into Pine Hollow, a deer
  path from Pine Hollow down into Tanglewood, and a wood-edge path from The
  Crossing into Tanglewood.
- **The Greystone Caves**: five floors, with mouths in the peaks, in Tanglewood
  and in the sea cliffs, so a group can go underground at one end of the vale and
  come out at another.
- **Seven ways out** (red), **five landings** (Mill Square is the front door) and
  two secrets to find.
- **Crossings are fixed in the plan**, so each district can be drawn on its own
  and still meet its neighbours, and a district added later at the plan's edge
  joins at a way out that becomes a crossing.

## Judged blind

Each round, two 48x40 views of Millbrook were judged blind beside FireRed
towns redrawn in the same tiles: Viridian, Pewter, Cerulean, Fuchsia and a
Celadon window. Every round used two fresh judges, and each judge scored every
picture 1-10 and named its biggest fault.

From round 2 on, two deliberately broken real towns rode in every batch as
controls: Cerulean with four blocks swapped, and Pewter with every block
shuffled. A judge only counts if it rates both below every real town.

Millbrook passes when, for each judge, both its views score at least that
judge's lowest real town and their mean is within a point of the real towns'
mean.

| Round | FireRed towns (mean) | Broken controls | Millbrook | Millbrook taken for real |
|---|---|---|---|---|
| 1, first draw | 5.4, 6.4 | none in the batch | 4 and 3, 4 and 4 (3.75) | 5-8% |
| 2, redrawn in FireRed pieces | 6.0, 6.0 | 1-3 | 5 and 5, 5 and 4 (4.75) | 8-10% |
| 3, after the faults of round 2 | 5.2, 5.6 | 1-2 | 7 and 5, 6 and 5 (5.75) | 20-25% |

**It passes on round 3**: both views sit inside the band the real towns score
(2-8), the mean is above theirs, and the judges took it for real as often as
Fuchsia and Celadon.

What each round fixed was what both judges named:

- **Round 1:**
  - props from another art set (the CC0 fountain, stalls and mill);
  - paths that stopped at the brook;
  - terrace ledges floating in grass;
  - an open east side.
- **Round 2:**
  - a ruled street grid;
  - copy-pasted fenced gardens;
  - a ruled ledge line;
  - stamped grass beds in an empty meadow.

Round 3's remaining faults, for the next pass:
- a mix of building styles;
- the forest-heavy foot of the village;
- the pool's shape.

### High Moor

High Moor was judged as two 24x40 views beside five FireRed routes cut to the
same size (Routes 1, 2, 6, 10 and 24), with two of them broken on purpose as
controls. Every judge in every round ranked both broken routes at or below
every real one.

| Round | What changed | FireRed routes (mean) | High Moor |
|---|---|---|---|
| 1 | an open moor | 7.4 | 4, 4, 4, 3 |
| 2 | a framed corridor, ledges on trees | 6.4 | 3, 5, 4, 4 |
| 3 | the stones as rock pillars | 5.8 | 3, 5, 2, 4 |
| 4 | heather everywhere, one gap a ledge row | 6.2 | 3, 4, 3, 4 |
| 5 | places along the road | 7.0 | 4, 4, 4, 5 |
| 6 | the stones as one tor, a wider road | 6.2 | 5, 4, 4, 5 |
| 7 | the land shapes the road | 6.4 | 5, 5, 5, 6 |
| 8 | no isolated pieces | 6.2 | **6, 6, 6, 6** |

**It passes on round 8**: both judges, both views, at or above each judge's
lowest real route and within a point of the mean.

Four lessons, each paid for by at least one round:
- **The shape:** an open field of any size reads as empty lawn, and FireRed's
  routes are framed corridors.
- **The stones:** a ring of stones in this art reads as placeholder markers,
  however it is arranged, because FireRed draws rock in masses.
- **Places, not patterns:** the judges' recurring word was "an arrangement,
  not a place".
- **The road:** a straight road with things set beside it is "a checklist of
  features"; the road has to wind round what stands in its way.

### Greystone Peaks

Greystone Peaks was judged the same way as High Moor: two 24x40 views beside
the same five FireRed routes and the same two broken controls, every round
with two fresh judges.

| Round | What changed | FireRed routes (mean) | Greystone Peaks |
|---|---|---|---|
| 1 | the river across open grass, rock in blocks | 6.2, 6.4 | 4 and 5, 4 and 5 |
| 2 | cliffs as the frame, the river in a gorge, every rock mass on a wall | 6.4, 6.4 | **6 and 6, 6 and 5** |

**It passes on round 2.** Both judges rated both broken controls below every
real route.

Round 1 was drawn with everything High Moor had taught, and still failed on
the frame: both judges said nothing framed the views. The lesson is
**a cliff is a wall only when it is the frame**. A mass of rock standing on
lawn reads as a block, however big; the same rock running out of the picture
along a corridor's side reads as a cliff, which is how FireRed's Route 24 draws
it.

What round 2 still named, for a later pass:
- the rock masses are similar rounded rectangles;
- the quarry's gravel bench looks pasted in;
- the climb has nothing to find along it but tall grass.

### The Crossing

The Crossing was judged the same way, beside the same five FireRed routes and
two broken controls, every round with two fresh judges. Round 4's draw was
replaced before it was judged.

| Round | What changed | FireRed routes (mean) | The Crossing |
|---|---|---|---|
| 1 | a wide valley, a river in jogs, a pale ford | 7.2, 6.4 | 5 and 6, 6 and 6 |
| 2 | the first redraw | 6.8, 6.6 | 4 and 4, 4 and 4 |
| 3 | a corridor with a straight river | 6.8, 6.8 | 4 and 3, 4 and 4 |
| 5 | a wide valley again, big square bends, no ford | 6.8, 6.6 | 4 and 4, 3 and 3 |
| 6 | a framed corridor, the river in short jogs | 6.8, 6.4 | 5 and 5, 5 and 4 |
| 7 | a straight river under a cliff, as Route 24 has it | 6.6, 6.6 | 5 and 5, 5 and 5 |
| 8 | ragged beds, a pool of two ponds, the heron hide | 6.2, 6.4 | 5 and 5, 5 and 5 |
| 9 | one big bend, the cottage door on the road | 6.2, 7.0 | 6 and 6 (pass), 5 and 5 |
| 10 | a pool with a natural edge, the wood turning the road | 6.4, 6.8 | 6 and 5 (pass), 5 and 6 |
| 11 | the bend made whole | 5.8, 6.0 | **6 and 6, 7 and 6** |

**It passes on round 11**: both judges, both views. Every judge rated both
broken controls below every real route.

What the rounds taught about water, which is most of what this district is:
- **Straight is fine; stepping is not.** FireRed draws a river as a straight
  channel and a pool as a plain shape, and the judges took both from it
  without complaint beside a cliff or a road. What read as generated was a
  river stepping sideways in two-tile jogs ("a staircase of rectangles"), a
  pool built of stacked rectangles, and a pale square of shallow water.
- **Draw the river after anything that could cut it.** In round 10 a tall
  grass bed drawn after the river cut through its bend, and a judge saw "two
  reaches that touch only at a corner". Nothing in the hard checks can see it.
- **A crossing goes somewhere at both ends.** The stepping stones were marked
  down while they led from grass to grass, and passed once a lane came down to
  them and the heron hide stood at the far end.

What round 11 still named, for a later pass: the road's long staircase
diagonal, and the stone slabs standing in for bridges, since no bridge on the
FireRed sheet spans a river from west to east.

## Pine Hollow, Tanglewood and the Greystone Caves

The two woods in the east of the vale, the deer path between them, and the
caves under them. They are drawn and pass, and joined the vale the game ships
with Greystone Peaks and The Crossing: the road from Millbrook over the bridge
runs on into Tanglewood, and the hidden trail from the peaks crosses the col
into Pine Hollow. `forests.test.ts` also holds each to every hard check on its
own. Both woods are FireRed's own forest conifer, the tree
Viridian Forest is drawn in. FireRed's broadleaf stands alone, and planted
shoulder to shoulder it reads as an orchard, so each wood has one broadleaf
standing in a clearing.

- **Pine Hollow**, the dark pine wood: one unsigned trail threads three
  clearings.
  - **The spring:** the trail comes in over the col from the peaks and skirts
    a pool.
  - **The hollow:** a sand floor worn bare in the middle of the wood, with a
    berry tree in it.
  - **The oak:** the one broadleaf among the pines, with Collier Bram burning
    charcoal under it.
  - The trail leaves east as the Pine Trail.
  - The deer path south is tall grass between the trunks, and nothing signs
    it.
- **Tanglewood**, the labyrinth on the road east. Its lanes loop and fork
  through thick wood, so a raid that leaves the road can lose it.
  - **The shrine:** a statue on bare ground in a glade the wood closes round,
    its ring of stones fallen, with one broadleaf leaning over it.
  - **The way underground:** a worn path runs from the shrine to the mouth of
    the Greystone Caves in the rock outcrop.
  - **A pool** where three lanes meet in the north-west, with a berry tree
    beside it.
- **Two hidden ways out**, one in each wood: the Charcoal Track at the back of
  the nook south of Pine Hollow's col, and the Deer Gap in a pocket by
  Tanglewood's road. Each wood's planned way out is at its far east end, and
  without these the hunter's blind window would not cover the walk out
  (`hunterFlee.test.ts`).
- **The Greystone Caves** (`greystoneCaves.ts`), five floors:
  - **Each mouth opens onto a floor of its own:** the peaks onto the top
    floor, the wood one floor down, the sea at the bottom. The only way
    between them is down and up again.
  - **The two middle floors are sealed:** each is two halves joined only
    through the floors above and below.
  - **Every third dead end hides something.**
  - **Mouths in districts drawn later:** the floors and ladders ride in
    Tanglewood's file, and Greystone Peaks and Gull Strand plant their mouths
    with `caveMouthLink`. A district with a mouth carries the floors and the
    ladders as well, so it passes its checks on its own; the stitcher takes a
    floor or a ladder two districts carry alike once (one carried differently
    is two places, and a problem). The peaks' mouth is in; until Gull Strand's
    is, its way out is a passage into the south wall that goes nowhere yet.

![Pine Hollow](pine-hollow.png)

![Tanglewood](tanglewood.png)

![The Greystone Caves, top floor on the left](greystone-caves.png)

### Judged blind

Each round, two 24x40 views of each district were judged blind beside five
FireRed windows redrawn in the same tiles: three of Viridian Forest and two of
Route 2. Every round used two fresh judges. Two broken real windows rode in
every batch as controls (four blocks swapped, every block shuffled). A judge
only counts if it rates both below every real map. The bar is Millbrook's: for
each judge that counts, both views score at least that judge's lowest real
map, and their mean is within a point of the real mean.

| Round | Real mean | Pine Hollow | Tanglewood |
|---|---|---|---|
| 1 | 6.4, 6.2 | 5 and 4, 5 and 4 | |
| 2 | 6.0 | 5 and 4 | |
| 3 | 6.2 | 5 and 4 | |
| 4 | 6.0, 7.0 | 5 and 5 (pass), 4 and 4 | |
| 5 | 6.8 | 6 and 4 | |
| T1 | 6.4 | | 4 and 3 |
| 6 / T2 | 6.2, 6.0 | **6 and 6, 5 and 5: passes** | 5 and 5, 4 and 6 (pass) |
| T3 | 6.0 | | **6 and 6: passes** |

Rows show only the judges that counted. Pine Hollow round 6 and Tanglewood
round 2 shared one batch.

What each round fixed was what the judges named:

- **Pine Hollow:**
  - a trail of grass that read as no path at all, so a sand path wears down
    it;
  - switchbacks that nothing forced, so the trail now bends only where the
    wood turns it;
  - single-file tree columns, a monolith block, and a ledge with nothing at
    its ends (the ledge went: it was not part of the one idea);
  - a pond like a plus sign, and paths that started and stopped in open
    grass, until the path led into the hollow's worn floor and out again.
- **Tanglewood:**
  - first drawn as islands of trees in open grass, which both judges called a
    stamped checkerboard with no walls, so it was redrawn as a labyrinth of
    lanes through thick wood;
  - a shrine pad the road's spur did not reach;
  - a north-west with nothing to find;
  - a cave mouth no path went to.

![Pine Hollow as first drawn](pine-hollow-first-draw.png)

![Tanglewood as first drawn](tanglewood-first-draw.png)

The caves were judged the same way, two floors beside five FireRed cave floors
(three of Mt. Moon, two of Rock Tunnel) with two broken ones as controls.

| Round | Real mean | Greystone Caves |
|---|---|---|
| 1 | 5.6, 4.6 | **6 and 5, 5 and 7: passes** (one judge took B2F for real) |

What is left for the next pass:

- **Pine Hollow:** the lower half of the spring's screen is still a dense
  block.
- **Tanglewood:** its north-west lanes are plain grass.
- **The caves:** both judges named the sand drifts as noisy blobs that do not
  belong.

## Reedmere

The marsh in the south-west, down the lane from Millbrook. **The dry way is
the long way:** an earth boardwalk goes round the mere, east to the trail for
Gull Strand and south and west to the Mere Path, while anyone in a hurry wades
straight through the reeds and pays for it in fights. The sign at the lane
says so: "The boardwalk goes round. The reeds go through."

- **The mere:** wide and still, with a grassed north bank and a jetty out over
  it. Netter Fen fishes from the jetty.
- **The reeds:** tall grass is the marsh's floor. Trodden lanes part it into
  beds, a dry hummock with a berry tree is left open in the north-west, and
  copses of trees give the beds their edges.
- **The Duck Hide:** at the end of a boardwalk spur in the south-west, with
  Birder Tess keeping watch.
- **One pond** in the north-east reeds, where the trail for the strand turns
  off.

![Reedmere](reedmere.png)

Judged blind the same way as the woods, beside FireRed's watery, grassy
routes: two windows of Route 12, and one each of Route 14, Route 24 and
Route 6.

| Round | Real mean | Reedmere |
|---|---|---|
| 1 | 6.2, 5.6 | 4 and 4, 5 and 5 |
| 2 | 6.2 | 5 and 5 |
| 3 | 6.2 | **6 and 6: passes** |

The table shows only the judges that counted. In rounds 2 and 3 the discarded
judge also scored Reedmere within the band (5 and 6, then 6 and 5), and in
round 2 it took a view for a real map.

What each round fixed was what the judges named:

- **Round 1:**
  - a shapeless sea of tall grass;
  - water broken into stamped rectangular pieces (channels and four pools);
  - a staircase lake shore;
  - an empty lawn.
- **Round 2:**
  - fiddly slivers of grass at the beds' edges;
  - lone tree pairs dotted about.

Round 3's remaining fault, for the next pass: there is little to find beyond
the grass.

![Reedmere as first drawn](reedmere-first-draw.png)

## Gull Strand

The coast in the south, where the river meets the sea, judged on the sea
cliffs and the strand.

- **The heath:** the river comes down from The Crossing across it. The road
  comes down beside the river to the strand and branches east to the
  orchards. The trail from Reedmere crosses the river on a stone bridge.
- **The cliffs:** a band of rock with a cove under it. The sea comes in behind
  a sand bar to make a lagoon, there is a tide pool in the rocks, and stone
  steps lead down from the cliff-top path. The sea cave's mouth is planted in
  the cliff foot once the Greystone Caves are stitched into the vale.
- **The Smugglers' Path:** a way out in a nook of the west wood above the
  heath. It was added when The Crossing was drawn: its stand-in ways out had
  kept the heath's far corner within the hunter's blind window.
- **The strand:** the landing, among rocks drawn up on the sand. A net loft
  stands on the heath above it with a fenced garden, and stepping stones cross
  the river mouth at low tide.
- **Fisher's Jetty:** the way off the map, a stone jetty out over the sea with
  FireRed's ferry moored at it.

![Gull Strand](gull-strand.png)

Judged blind beside FireRed's coast: two windows of Vermilion City's harbour,
and one each of Route 19, Route 12 and Route 24. Round 1 was void: a broken
Route 19 window is mostly water, so swapping its blocks hardly broke it, and
both judges scored it as well as a real map. A broken Route 12 replaced it.

| Round | Real mean | Gull Strand |
|---|---|---|
| 1 (void) | 6.2, 5.8 | 5 and 3, 3 and 5 |
| 2 | 6.0, 5.6 | **5 and 5, 6 and 5: passes** (one judge took the cliffs for real) |

What round 2 fixed was what round 1's judges named:

- the west half's featureless slab of rock with no path, which became the
  cliff band, the cove and the steps;
- an empty lawn with features dotted about, so the wood came in down the
  heath's east side and the grass beds grew.

After round 2, three rocks were added round the landing, because holding any
direction from a landing has to meet something within four steps
(`mapStructure.testkit.ts`).

Round 2's remaining faults, for the next pass: the lagoon's stepped bank, the
straight line of the cliff, and the empty grass on the heath.

![Gull Strand as first drawn](gull-strand-first-draw.png)

## Orchard Terraces

The farm in the south-east. **It does not pass the blind check**, and it ships
explorer-only as the best of eight rounds, as the night's instruction allowed
when a district could not pass in time.

- **The farmyard:** the farmhouse, the apple store, a kitchen garden with a
  berry bush, and the landing.
- **The shelves:** three of them step down the hillside, each edged by broken
  runs of ledge anchored on clumps of trees.
  - The top shelf holds the farmyard and the north orchard, where the trail
    from Tanglewood comes in.
  - The middle shelf holds the west orchard and the cornfield, with the lane
    out east as Orchard Lane.
  - The bottom shelf is the pasture over the shore.
- **The ledges:** the farm road goes down by the one gap in each edge, the long
  way round; a hop down a ledge is the quick way, never back up.

![Orchard Terraces](orchard-terraces.png)

It was judged beside FireRed's Route 1, Route 2, Route 6, Route 24 and
Route 10 (two broken real routes as controls), the bar the other districts
met.

| Round | Real mean | Orchard Terraces | What was tried |
|---|---|---|---|
| 1 | 7.2, 6.2 | 2 and 2, 3 and 4 | open slope, orchard pens, ruled ledges |
| 2 | 7.0, 6.8 | 5 and 3, 3 and 4 | wooded shelves, a ledge cut through each band |
| 3 | 7.4, 7.6 | 6 and 5, 4 and 4 | denser: a sand yard, fields, wide road |
| 4 | 7.0, 7.0 | 5 and 4, 4 and 5 | ragged bands, rocks at the ledges' ends |
| 5 | 7.6, 7.0 | 4 and 5, 4 and 5 | the shelf edges are the ledges |
| 6 | 6.2, 7.2 | **5 and 5, 5 and 5** (ships) | irregular orchards, paths across the shelves |
| 7 | 7.0, 7.2 | 4 and 4, 4 and 4 | thicker wood at the sides |
| 8 | 7.4, 7.0 | 4 and 4, 4 and 4 | fields in hedgerows of trees |

Every judge counted in every round. Round 6 came within 0.2 of the bar with
one judge. After it, three shrubs were added round the landing for the
held-direction rule.

What the judges kept naming, for the next pass:

- **The orchards** read as stamped grids, however the trees are spaced.
- **Too much lawn** with little edge.
- **Every ledge reads as floating**, whatever stands at its ends.

Route 1 and Route 2 are the hardest references any district has been held
to: they scored 7 to 9 every round.

![Orchard Terraces as first drawn](orchard-terraces-first-draw.png)

## How it ships

As the game's own map, beside the shipped five (`greystone-vale`, built from the
stitched file `src/game/world/maps/greystoneVale.json` through the same path a
player's map is built by). While its districts are being drawn it is on
`MAPS_IN_PROGRESS` (`src/game/worldMap.ts`):

- **Only the explorer run reaches it** (PLAYTEST on the title, then Oak's Lab):
  no save is offered its landing, no contract or board names it, and
  `greystoneVale.test.ts` holds that against every contract banked.
- **Every structure and safety rule holds it now** - every way out reachable in
  the clock, a sealed edge, the hunter's fair arrival and flee, no crown over a
  walked tile - through `mapStructure.greystoneVale1-4.test.ts` and the rest of
  the suite.
- **What a finished map pays and guards waits for its districts**: its boss and
  two doors, its key exit and key, its locked crate, its loot (money,
  materials, packs and prizes), an exit a landmark opens, wildlife that differs
  from place to place, and a place in the drop-in frame's size. Each test that
  asks one of those names `MAPS_IN_PROGRESS` where it excuses the vale. It
  opens to saves with all of them once the vale is drawn.
- **No other map's raid changes**: like a player's map, it is in a raid's
  content only when the raid is on it, so every seeded roll on the shipped five
  is what it was.
