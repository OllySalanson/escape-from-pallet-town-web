# mapcraft: before and after

Viridian City's south district, the twenty rows under the shipped town, drawn
two ways by an AI. Both pictures are the game's own renderer; the `-moves`
versions wash the design moves in colour (`tools/mapcraft/picture.mts`): blue
the border, orange the road, pink plain lawn, green tall grass, purple what
stands in the open, red outline ledges, white outline fences.

| | Before: round 2's best (program, look-and-fix) | After: drawn with `tools/mapcraft` |
|---|---|---|
| Picture | `before-round-2.png` | `after-viridian-south.png` |
| Moves | `before-round-2-moves.png` | `after-viridian-south-moves.png` |
| Road, share of the walkable ground (FireRed 37%) | 3% | 41% |
| Plain lawn (FireRed 42%) | 77% | 48% |
| Ledge pieces | 6, about 12 long, none stacked | 9, median 6, 56% stacked |
| Border depth (FireRed 5) | 2 | 4 |
| Fence runs (FireRed about 5) | 1 | 6 |
| Blind score, same tiles as real routes (real FireRed routes: 5.7) | 5.5 | 6.0 |

The after map is `tools/mapcraft/examples/viridianSouth.ts`; regenerate both
pictures of it with

    npx vite-node tools/mapcraft/look.mts -- tools/mapcraft/examples/viridianSouth.ts out/viridian-south

The scores are the blind judges' from round 3 of the map research (12 October
2026). Since then the toolkit's *every open tile can be walked to* check found a
two-tile pocket the scored map had sealed behind a rock, and the example has one
rock fewer.
