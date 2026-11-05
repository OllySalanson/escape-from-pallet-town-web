# Exit rides: every way out is a vehicle

The captain, 5 Nov 2026: extraction points stop being green squares and become
the vehicles a Pokemon game leaves a place by. `src/game/world/exitVehicles.ts`
picks the ride from the ground round the exit, first rule that applies:

| ground | ride | from |
| --- | --- | --- |
| under a roof (cave, tunnel, room) | minecart, on its rails | drawn here |
| deep water beside the exit | Mr. Briney's boat, moored on the water, bow to the open water | Emerald (pret/pokeemerald) |
| a cliff within two tiles | Pidgeot, hovering with its shadow | HeartGold following art (pret/pokeheartgold) |
| anywhere else | the Bicycle, side on, facing into the wood the way out leads into | FireRed's Bike Shop (pret/pokefirered) |

Nothing is stored and no map names a ride: a map maker's exit and a stitched
district's stand-in get theirs by being where they are. A locked exit's ride
waits at 40% (a timed boat is a boat not yet come); when the exit opens it comes
in, and stepping on an open one boards it and it leaves the way it faces before
the result screen. Rubble and a locked gate still stand in front of a barred
exit until it is opened. Rules, timers, collision and the save are unchanged.

Photographed with `tools/playtest/exitRides.mjs` (Greystone Vale and the
sample player map) and `tools/playtest/makerExitRides.mjs` (the maker and a
draft walked with WALK IT), at the 3x window against test-mode builds of
`main` (before) and this branch (after).

| | before | after |
| --- | --- | --- |
| Goat Track, a pocket in the wood | ![](goat-before.png) | ![](goat-after.png) |
| Fishers' Boat, the end of a jetty | ![](fishers-before.png) | ![](fishers-after.png) |
| Cloud Stair, on the peaks | ![](cloud-before.png) | ![](cloud-after.png) |
| Salvage Launch, opens at 100s | ![](salvage-before.png) | ![](salvage-after.png) |
| Escape Hatch, in the Bunker | ![](hatch-before.png) | ![](hatch-after.png) |
| Service Gate, locked to the Card Key | ![](gate-before.png) | ![](gate-after.png) |
| A player's map: North Stile | ![](player-map-stile-before.png) | ![](player-map-stile-after.png) |
| The map maker, an exit on a pond's bank | ![](maker-before.png) | ![](maker-after.png) |

Leaving by boat: ![](boarding-0.png) ![](boarding-1.png) ![](boarding-2.png)

The player's map walked from the maker: the pond's boat, the crag's Pidgeot,
and the boat leaving: ![](player-map-ferry-steps.png) ![](player-map-crag.png)
![](player-map-boarding.png)
