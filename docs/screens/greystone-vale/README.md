# Greystone Vale

A new raid map, planned coarse and drawn one district at a time with
`tools/mapcraft` (its source is `tools/mapcraft/worlds/greystoneVale/`). This
is the plan, before any district was drawn:

![plan](plan.png)

And the vale with its first district, Millbrook, drawn: every district still to
draw is wood, and each road into one runs into the trees at a way out.

![the vale with Millbrook drawn](vale.png)

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
  walked tile - through `mapStructure.greystoneVale.test.ts` and the rest of
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
