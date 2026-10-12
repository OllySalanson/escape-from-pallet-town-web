# Greystone Vale: the world plan

A new raid map, planned coarse and drawn one district at a time with
`tools/mapcraft` (its source is `tools/mapcraft/worlds/greystoneVale/`). This
is the plan, before any district is drawn:

![plan](plan.png)

Redraw it with

    npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/worlds/greystoneVale/index.ts out/greystone-vale

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

## How it will ship

As a bundled map file, the game's own path for a map that is not one of the
shipped five (`src/game/world/playerMaps.ts`): once its first district is
drawn, the stitched map goes in as `src/maps/player/greystone-vale.json`, held
to the game's map checks by the test suite and playable as a raid at once, with
every district not yet drawn standing as forest.
