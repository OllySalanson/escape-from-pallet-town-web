# The third ring: 130 to 200 steps out from Mill Square

The captain, 30 October 2026: start where you start and work outwards on the sparsest
bits, to the harbour's standard. [Millbrook](../millbrook/README.md) was the first ring and
the [second](../second-ring/README.md) the next one out. This is the third: Tanglewood,
Smugglers' Cove, Greystone Peaks and Orchard Terraces, with the Sunken Quarter, Pine Hollow
and the Safari gate.

## What a screen holds, measured

`npx vite-node tools/tileset/screens.mts -- --rings`: the 25x16 view round every tile a
player can stand on.

| | kinds of tile | figures | to read | to find | nobody in view |
|---|---:|---:|---:|---:|---:|
| The harbour | 114 | 4.9 | 4.9 | | 3% |
| 130-200 steps out, before | 52 | 1.7 | 1.9 | 0.7 | 29% |
| **130-200 steps out, after** | **66** | **5.3** | **4.6** | **1.3** | **1%** |

The tool's list at 200-300 is where the next ring starts from.

## The places

**Tanglewood** was thirty screens of the same pines. It is still a maze, and every fork comes
out at somebody who got lost in it. In the middle is MISLAID, a hamlet of people who took one
turn off the road, with a pub called The Way Out.

![Mislaid](05-mislaid.png)
![The Way Out](06-the-way-out.png)
![the shrine glade](03-the-shrine.png)
![the woodmen's stand](01-the-woodmens-stand.png)
![the halfway stone](02-the-halfway-stone.png)
![the mushroom ring](07-the-mushroom-ring.png)
![the butterfly ride](09-the-butterfly-ride.png)
![the windfalls](10-the-windfalls.png)

**Orchard Terraces** is a farm in the week of the apple harvest. Its hens are Doduo, there is an
honesty box on the lane with somebody not watching it, and the shore, which was sixty tiles of
ruled sand, has spits and tide pools and a slip for the boat.

![the farmyard](11-the-farmyard.png)
![the honesty box](13-the-honesty-box.png)
![the cider press](14-the-cider-press.png)
![the dew pond](17-the-dew-pond.png)
![the cockle beds](18-the-cockle-beds.png)
![the slip](19-the-slip.png)

**The Sunken Quarter** has people on its dry half who have not stopped arguing about the wet one,
and past the keeper the divers, the salvage, and an old Mayor who has not resigned.

![the Old Quay](20-the-old-quay.png)
![the upper street](21-the-upper-street.png)
![the drowned town](23-the-drowned-town.png)

**Smugglers' Cove** is a village's worth of people who are very firmly not smugglers: signs down
the deer path saying there is nothing down it, the Revenue man on the cliff with his back to all
of it, a fish stall with no fish, and the Cut, where the good stuff waits for a cart.

![the Cut](24-the-cut.png)
![Fisher's Row](25-fishers-row.png)
![the Revenue post](27-the-revenue-post.png)
![the landing stage](28-the-landing-stage.png)

**Greystone Peaks** is a working mountain: stone carts, Mrs Gantry's rope, a quarry with somebody
quarrying it, a tarn that is no longer a swimming bath, and a bothy at the head of the pass.

![the stone carts](30-the-stone-carts.png)
![the quarry](31-the-quarry.png)
![the tarn](32-the-tarn.png)

**Pine Hollow** still has not one sign, because nobody there wants to be found. Its people tell you,
grudgingly: the resin tappers and the weeping pine they work, and a linesman who lost a card.

![the cold spring](34-the-cold-spring.png)
![the weeping pine](35-the-weeping-pine.png)
![the Pikachu glade](36-the-pikachu-glade.png)

Everything here is the real game at its 3x window, on the explorer run, so the corner chip says
PLAYTEST. `tools/playtest/thirdRing.mjs` walks all of it on foot from Mill Square and takes these.
