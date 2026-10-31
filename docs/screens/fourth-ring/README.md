# The fourth ring: 200 to 300 steps out from Mill Square

The captain, 30 October 2026: start where you start and work outwards on the sparsest
bits, to the harbour's standard. [Millbrook](../millbrook/README.md), the
[second ring](../second-ring/README.md) and the [third](../third-ring/README.md) came first.
This is the fourth: the east column of the vale, which is the Power Station, Safari Marsh and
The Wreck, with two nooks on Pine Hollow's road out.

## What a screen holds, measured

`npx vite-node tools/tileset/screens.mts -- --rings`: the 25x16 view round every tile a
player can stand on.

| | kinds of tile | figures | to read | to find | nobody in view |
|---|---:|---:|---:|---:|---:|
| The harbour | 114 | 4.9 | 4.9 | | 3% |
| 200-300 steps out, before | 53 | 2.8 | 2.5 | 0.7 | 16% |
| **200-300 steps out, after** | **67** | **6.2** | **5.0** | **1.1** | **0%** |
| The Power Station, before | 52 | 0.7 | 1.5 | 0.7 | 36% |
| **The Power Station, after** | **76** | **6.4** | **6.1** | **1.4** | **0%** |
| Safari Marsh, before | 48 | 2.0 | 2.0 | 0.5 | 17% |
| **Safari Marsh, after** | **70** | **8.2** | **6.2** | **1.1** | **0%** |
| The Wreck, before | 47 | 0.9 | 1.5 | 0.4 | 28% |
| **The Wreck, after** | **71** | **6.5** | **5.5** | **1.3** | **0%** |

Safari Marsh runs high on purpose: 29 of its figures are Pokémon, and it is the reserve.

Past this ring `--rings` has nothing left on foot. What is thin now is the far places (Stormcrown,
the Moor Chapel, the Lost Garden, Frostreef, Ember Isle), which are thin and hard to reach on
purpose. They were left alone.

## The places

**The Power Station** is the company town the turbines left behind, which has not been told. The
shift has been on strike on the forecourt for nine years, against a management that went home in
the flood. The one man who still goes in, to dust, has noticed something yellow on the turbine floor.

![the picket](01-the-picket.png)
![the company shops](02-the-company-shops.png)
![Turbine Row](04-turbine-row.png)
![the allotments](06-the-allotments.png)
![the tip](07-the-tip.png)
![the bus stop](08-the-bus-stop.png)
![the switchyard](13-the-switchyard.png)
![the warm water](12-the-warm-water.png)

The sailing club's dinghy is the one way out to the valve tower, where a man has been turning a
wheel for years because nobody relieved him. It is a route only the player has: the hunter cannot sail.

![the sailing club](16-the-sailing-club.png)
![the valve tower](17-the-valve-tower.png)

**Safari Marsh** is a reserve whose Warden has gone down to the harbour about his teeth, and left it
to everybody else. The pools are drawn now, not rolled.

![the hide](20-the-hide.png)
![the nursery](24-the-nursery.png)
![the tour](27-the-tour.png)
![the wallow](28-the-wallow.png)
![the great pool](26-the-great-pool.png)
![the rangers' camp](25-the-rangers-camp.png)
![the south planks](29-the-south-planks.png)

**The Wreck** is where everybody has come for something. The camp sells her off by the lot; the
first-class passengers are still on the beach in their good clothes, waiting to be told when dinner
is; and two men have spent a week getting the ship's piano up the trail to the marsh.

![the piano](30-the-piano.png)
![the viewpoint](31-the-viewpoint.png)
![the auction](36-the-auction.png)
![the Lido](37-the-lido.png)

And she can be boarded: a salvage stage on piles runs round her bow from the end of the bar to a hole
in her side, and the hold is still full.

![the salvage stage](38-the-salvage-stage.png)
![the forward hold](39-the-forward-hold.png)

Everything here is the real game at its 3x window, on the explorer run, so the corner chip says
PLAYTEST. `tools/playtest/fourthRing.mjs` walks all of it on foot from The Dam and takes these;
`fourthRing.test.ts` measures the walk from Mill Square.
