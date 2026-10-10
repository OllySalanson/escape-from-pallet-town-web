# Caves

The third step of linked areas (`docs/maker-areas.md`): a cave mouth cut into a
rock face, the cave behind it drawn as Mt. Moon is drawn, floors below it down a
ladder, and a way to join two places that already exist in two clicks.

The art is Mt. Moon's own, cut from pret's FireRed disassembly by
`scripts/cut-frlg-areas.mjs` (provenance in `public/assets/ASSET_PROVENANCE.md`):
its floor, its sand with every edge and corner, its rock, its boulders, its
crater, the water dripping off its back wall, its two ladders and the daylight
of its way out. FireRed draws every face of the rock on the top layer, over the
floor or the sand alike, so the rock is laid over whatever ground is beside it
and turns the corners of a room with FireRed's own joints.

| | |
|---|---|
| `before-play-rock.png` | Before: a rock face on the map is a wall. Walking up to it does nothing. |
| `maker-1-mouth-chosen.png` | After: a Cave mouth from the Nature list, cut into the foot of the rock, chosen. It says it leads nowhere yet, and offers its cave. |
| `maker-2-cave.png` | MAKE ITS CAVE: a cave ringed in rock the way Mt. Moon's ground floor is - two rows along the back, one down each side and one along the foot with the daylight of the way out in it - with sand in two corners, a crater, boulders and dripping water. The cave's own brushes are its floor, its rock and its sand. |
| `maker-2b-cave-pieces.png` | A cave's Places include its three ways through (ladder down, ladder up, way out), and its furniture is the cave's own. |
| `maker-3-below.png` | ADD A FLOOR BELOW digs B1F, a room standing on the dark with only its back wall, as Mt. Moon's basement is, and the ladder up out of it. |
| `maker-6-where-does-it-come-out.png` | A second cave mouth, made a second way into the same cave in two clicks: INTO A CAVE YOU HAVE, then where it comes out. While it waits, the map says what to click and the entrance is marked. |
| `maker-7-second-way-out.png` | Clicked on the cave's south wall: a second notch of daylight. Its panel names where it leads and goes there. |
| `play-1-at-the-mouth.png` | In play, at the mouth. |
| `play-2-in-the-cave.png` | Walked up into it: inside the cave, in front of the daylight, facing in. |
| `play-3-at-the-ladder-down.png` | At the hole with the ladder down it, captioned with where it goes. |
| `play-4-below.png` | Down it: on the foot of the ladder up, on B1F. |
| `play-5b-in-by-the-second-mouth.png` | In by the second mouth: the same cave, at its second way out. |
| `play-6-met-in-the-cave.png` | Every step of a cave's floor is wild ground, and what lives there is Mt. Moon's own: Zubat, Diglett, Sandshrew. |

Taken from a `VITE_EPTW_TEST_MODE=pixels` build at 1200x768 by
`tools/playtest/makerCaves.mjs`, which paints the rock with the Box tool, cuts
the mouth, makes the cave and its floor below, joins the second mouth, then walks
in by both mouths, down the ladder and back up, out by the daylight, and across
the floor until something lives there, checking each step. The before shot is
the same map on a build without caves.

The battle backdrop is still the game's one grass field, in a cave as anywhere:
pret has FireRed's own cave and grass battle terrains, and putting them in is a
change to every battle, not to caves.
