# Millbrook: the vale, filled from where you start

The captain, 30 October 2026: "I was looking around the Greystone Vale map and it
feels somewhat sparse", beside the harbour he had just been enjoying. And then:
"because it's such a big map I think we should work on where you start first and
work outwards from there on the sparsest bits."

This is the first ring out from Mill Square, where a new game lands: Millbrook,
and the first stretch of each road out of it into High Moor, The Crossing and
Reedmere. The next rings are the same work further out.

## What sparse was, measured

`npx vite-node tools/tileset/screens.mts -- --rings`: what the 25x16 screen round
every tile a player can stand on holds.

| | kinds of tile | figures | things to read | things to find | nobody in view |
|---|---:|---:|---:|---:|---:|
| The harbour | 114 | 4.9 | 4.9 | | 3% |
| Millbrook, before | 78 | 1.3 | 2.2 | 0.4 | 29% |
| **Millbrook, after** | **103** | **4.3** | **4.8** | **1.3** | **0%** |
| The first ring out, 40-80 steps, before | 42 | 1.1 | 1.4 | 0.8 | |
| **The first ring out, after** | **51** | **2.6** | **2.6** | **1.0** | **3%** |

## What makes the harbour rich, and what it took here

- **Every screen is a place doing something, with somebody there.** A market on the
  square, sacks in the mill yard, dug allotments and somebody digging them.
- **People move and call out.** They walk a small beat (`MapFileBeat`), and say a few
  words unasked as you pass (`world/villageCalls.ts`). Pokémon wander too.
- **The ground moves.** FireRed's own water and flowers now move on raid maps
  (`TileAnimator`), water laps within a few steps of it, and a bird goes over by day.
- **It is the harbour's hand.** A stone square, earth streets, broadleaves in the open
  and the pines behind them, and a wood's edge that comes in and out.
- **The roads go through somewhere.** North past a pound, west past a camp, south round
  a woodcutter's glade and an orchard, where each was twenty tiles of sand between
  ruled walls of pine.
- **Doors open.** The mill, the Center, the Mart, Ott's cottage and the woodshed.
- **There are things to do that people let slip.** Berry trees, hidden finds, the island
  over the stones, Pokémon you can walk up to and fight, and Hazel's walled garden
  behind a Cut tree.

## Before and after

| Before | After |
|---|---|
| ![the square before](before-square.png) | ![the square after](after-somebody-calling.png) |
| ![the lane south before](before-lane-south.png) | ![the lane south after](after-lane.png) |
| ![the drove road before](before-drove-road.png) | ![the drove road after](after-drove.png) |
| ![the north street before](before-north-street.png) | ![Old Row after](after-oldrow.png) |
| ![the east street before](before-east-street.png) | ![the mill after](after-mill.png) |

## The rest of it

![Tom's pool and the island](after-pool.png)
![the orchard](after-orchard.png)
![the woodcutter's glade](after-glade.png)
![the millpond](after-pond.png)
![inside the mill](after-inside-the-mill.png)
![the Cut tree to Hazel's garden](after-the-cut-tree.png)
![the foot of High Moor](after-moorfoot.png)
![the West Bank at The Crossing](after-westbank.png)
![the reed yard at Reedmere](after-reedyard.png)

And the harbour it was held against:

![Harbour Square](harbour-square.png)

Everything here is the real game, photographed at its 3x window by
`tools/playtest/millbrook.mjs` and the explorer run, so the corner chip says PLAYTEST.
