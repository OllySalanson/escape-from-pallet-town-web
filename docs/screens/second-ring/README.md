# The second ring: 80 to 130 steps out from Mill Square

The captain, 30 October 2026: start where you start and work outwards on the sparsest
bits, to the harbour's standard. [Millbrook](../millbrook/README.md) was the first ring;
this is the next one out, which is most of Reedmere, The Crossing, High Moor and the
heath at Gull Strand, with the feet of the peaks and the edge of Tanglewood.

## What a screen holds, measured

`npx vite-node tools/tileset/screens.mts -- --rings`: the 25x16 view round every tile a
player can stand on.

| | kinds of tile | figures | to read | to find | nobody in view |
|---|---:|---:|---:|---:|---:|
| The harbour | 114 | 4.9 | 4.9 | | 3% |
| 80-130 steps out, before | 38 | 1.0 | 1.1 | 0.5 | 32% |
| **80-130 steps out, after** | **70** | **5.3** | **5.1** | **1.3** | **0%** |
| 40-80 steps out, before | 52 | 2.9 | 2.9 | 1.0 | 1% |
| **40-80 steps out, after** | **67** | **5.1** | **4.6** | **1.2** | **0%** |

The tool's list under each ring is where the next ring starts from.

## The places

**Reedmere** was a lane round a pond, and is a working fen. The way round is a real
boardwalk now, FireRed's own plank decking (`boardsSheet.ts`) over the reeds and the water.

![the boardwalk](01-the-boardwalk.png)
![Pond Boy's pond](02-pond-boy.png)
![the staithe](03-the-staithe.png)

The punt goes from the staithe to Duck Island, which nothing else reaches.

![the punt, moored](04-the-punt-moored.png)
![on the mere](05-on-the-mere.png)
![Duck Island](06-duck-island.png)

Mere End is the marsh's own hamlet: stilt houses on the bay, the street a deck along
their fronts, and the Drowned Duck on it. The eel market, then the turbary behind it.

![Mere End](07-mere-end.png)
![the Drowned Duck](08-the-drowned-duck.png)
![the eel market and the turbary](09-the-eel-market.png)
![the duck hide](10-the-duck-hide.png)

**Gull Strand** was a lawn with beds on it, and is a fishing shore: the Old Light and the
keeper nobody has told, the rope walk, the sailors' rest, the salt pans, Fisher Row, the
quay market and the wrackers' sand.

![the Old Light](11-the-old-light.png)
![the salt pans](12-the-salt-pans.png)
![the quay](13-the-quay.png)

**The Crossing** has a street at last. Bridge End is where the roads part, with the Coach
and Ponyta on it, and the valley has the masons' yard, the anglers' stage, the drovers'
rest, the bee garden, the heron walk, the eel weir and the charcoal burners.

![Bridge End](14-bridge-end.png)
![the Coach and Ponyta](15-the-coach-and-ponyta.png)
![the bee garden](16-the-bee-garden.png)
![the stone yard](17-the-stone-yard.png)

**High Moor** has the Moor Gate and its clerk, the Little Stones nobody can count, the
drovers' fold and camp, the shepherd and a flock that is not sheep, and Moor Spring,
where Millbrook takes the waters. Behind a boulder in the east wood is the Lost Fold,
for whoever brings Strength.

![the Little Stones](18-the-little-stones.png)
![the boulder in front of the Lost Fold](19-the-boulder.png)

Everything here is the real game at its 3x window, on the explorer run, so the corner
chip says PLAYTEST. `tools/playtest/secondRing.mjs` walks all of it on foot from Mill
Square and takes these.
