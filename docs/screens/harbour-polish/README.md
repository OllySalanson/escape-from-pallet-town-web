# Harbour polish

Four things the captain reported about the Harbour on 1 October: Brock's
workshop was the wrong way round, the inside of it did not look very good, the
tops of the trees were cut off, and one of the barrels was covered by the dirt
walkway.

The in-game shots are the real game in a 1280x800 window
(`node tools/playtest/baseRooms.mjs <url> <dir> --built=all --hurt=2`), with
every rung of Brock's ladder built. The close-ups are drawn by the game's own
layer builder (`tools/base/renderBase.mts`, `tools/tileset/renderMap.mts`).

| before | after | |
|---|---|---|
| `yard-before.png` | `yard-after.png` | The yard in the game. |
| `workshop-front-before.png` | `workshop-front-after.png` | The workshop was the CC0 barn, which that sheet only ever draws from behind: a roof, two vents and a blank wall, with the doorway cut into the wall where no door is drawn. It is a FireRed corrugated-iron shed now, its plank door at the end nearest the lab so the walk to it is still seven steps. |
| `workshop-room-before.png` | `workshop-room-after.png` | Inside, every rung built. |
| `workshop-bare-before.png` | `workshop-bare-after.png` | Inside, nothing built yet. |
| `tree-tops-before.png` | `tree-tops-after.png` | The trees behind the yard. |
| `route1-trees-before.png` | `route1-trees-after.png` | The same fault on every map: Route 1's wood. `route1-in-game-after.png` is that wood in the game. |
| `barrels-before.png` | `barrels-after.png` | The barrels on the quay. |

## What was wrong, and what changed

- **The workshop's room** is a room of FireRed's Rocket Warehouse, and it is
  drawn the way that warehouse draws one now. It is walled on both sides. The
  warehouse is lit from the top left: the floor is the lit plate, the back and
  west walls throw full shade on the floor beside them, and what stands against
  the back wall throws half a tile of shade below it. The first cut laid the
  half-shaded plate - the commonest cell in the render, because its first room
  is full of crates - as the whole floor, which is why the room was one dull
  olive sheet. Five things in it were cut a row short and stood with their tops
  sliced off - the generator's head, the tops of the radio terminals, the
  telephone, the grille and the monitor desk - because the render draws each
  across the line between two rows. Brock stands behind his steel bench, which
  the player is served across like Joy's counter, and every rung still has its
  own bay, bare floor until it is built.
- **Every tree.** FireRed draws a broadleaf's crown five pixels taller than its
  3x3 block, over the grass of the tile above. The sheet was cut to the block,
  so every tree on every map stood with the top of its crown in a straight
  line. The strip is lifted off the same source sheet and drawn as the tree's
  brim, on a layer of its own above the crowns, deciding nothing - not a wall,
  not somewhere to stand hidden. The yard's top row of trees stands a row lower,
  so the edge of the map does not slice them instead.
- **The barrels.** The sheet's own pair is a barrel and a stack of two whose
  top barrel is sliced off by the top of the sheet; on the quay, right under
  the yard's edge, it read as a barrel buried under the path. The pair is two
  of the one complete barrel now, on every map that has one.
