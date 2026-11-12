# Shimmering grass

One patch of tall grass a raid glitters, a little off the walk to the stake.
Step into it and it is that place's rare Pokémon at once, a level over the best
the place rolls, and the one wild meeting with better than the wild's odds of a
shiny: one in fifty, against one in 500. `src/game/world/shimmer.ts` is the rule.

## What glitters where

| Ground | What the patch holds |
| --- | --- |
| The woods (Tanglewood, Pine Hollow) | Pikachu or Bulbasaur |
| The moor's meadows (High Moor) | Ponyta or Doduo |
| The fields (Greystone Peaks, Orchard Terraces) | Mankey or Growlithe |
| The reeds (The Crossing, Reedmere) | Squirtle or Farfetch'd |
| KOGA's marsh (Safari Marsh, The Wreck) | Chansey, Kangaskhan, Pinsir, Scyther or Ekans |
| Anywhere else with tall grass | The least common thing its own table holds: a Charmander in Millbrook, an Electabuzz at the Power Station, a Shellder on the strand |

Growlithe and Ekans could not be had on the vale at all before this, so the
patch is also what takes them, Arcanine and Arbok off the list of Pokémon the
Pokédex could never hold (`pokedexReach.test.ts`).

## How to find it

Follow the gold arrow towards the raid's stake: the patch lies a couple of
tiles off that walk, inside a small screen of it. It is three white glints over
one tile of tall grass. Oak's full list (O, then O again) says the place and
the way: "Something rare is moving in the tall grass in THE STONE YARD, to the
east. Look for the glitter." It never says what is in it.

It is met once. Run from what is in it, or lose to it, and the grass stops
glittering for that raid. There is none on a new save's first raid, and none
from the Old Quay or Cove Steps landings, which stand on stone and sand.

## Played

A test-mode build (`VITE_EPTW_TEST_MODE=pixels`), `tools/playtest/raid.mjs
--pixels --stepped --window=pixel --seed=7 --clock=day
--insertion=greystone-vale --banked=2 --level=12
--steps=walk:178:141,shot:from-the-path,shimmer,shot:glitter,shimmer:shiny,shot:after --shot-battles`.
The "before" picture is the same raid on a build of the commit before.

| | |
| --- | --- |
| ![](01-before.png) | Before: the stone yard in The Crossing, on the way from Mill Square to this raid's stake. |
| ![](02-from-the-path.png) | After: the same raid. One tile of the tall grass by the masons' shed glitters. |
| ![](03-beside-it.png) | Beside it. Three glints, each coming up in its turn, so one is always bright. No caption: a prize is a thing lying there, and this is something moving in the grass. |
| ![](04-farfetchd.png) | Stepping in: a Farfetch'd, Lv 7, at once, with no roll about whether. The reeds' table tops out at 6. |
| ![](05-shiny.png) | One raid in fifty it is shiny. The driver answered that roll yes for this picture (`shimmer:shiny`); nothing else about the raid was touched. |
| ![](06-after.png) | Afterwards the grass has stopped glittering, and holds nothing more this raid. |
