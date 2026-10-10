# The Underground Path

The sixth step of linked areas (`docs/maker-areas.md`): FireRed's Underground
Path, a way through that comes out somewhere else on the map. It goes down a
stairwell in the entrance of one hut, along FireRed's own tunnel, and up the
stairs at its far end into the entrance of another hut.

All of it is FireRed's own, cut from pret's FireRed disassembly (provenance in
`public/assets/ASSET_PROVENANCE.md`). The hut is Route 5's, cut by
`scripts/cut-frlg-towns.mjs`. The entrance room, with its guard posts and
stairwell, and the tunnel are cut by `scripts/cut-frlg-areas.mjs`. The tunnel
is the north-south one, laid cell for cell from the game's own layout, so its
floor runs from planks to blue to red and back down its length, its walls
carry every rivet, and the lamps hang where FireRed hangs them. It is FireRed's
size, 8 by 63.

It is made in two clicks: choose a hut and press **MAKE THE UNDERGROUND PATH**,
then click the hut it comes up in. Both entrances are made if they are not
already, the tunnel is dug, and the hut further north goes down to the tunnel's
north end, as Route 5's does, and the other comes up at its south end.

| | |
|---|---|
| `before-maker-river.png` | Before: a river across the map with the drop-in north of it and the only exit south of it. Nothing crosses it, and the checks say so. |
| `maker-1-hut-chosen.png` | After: an Underground Path hut either side of the river. The north one is chosen, and offers the path. |
| `maker-2-where-it-comes-up.png` | MAKE THE UNDERGROUND PATH: the map asks for the hut where it comes up. |
| `maker-3-tunnel.png` | The south hut clicked: the path is made, and the maker opens its tunnel. |
| `maker-4-entrance.png` | A hut's entrance: the guard posts, a palm in each corner, and the stairwell down in the middle of the floor. |
| `maker-5-outside.png` | The map with its path: every check passes. |
| `play-1-at-the-hut.png` | In play, at the north hut's door. |
| `play-2-in-the-entrance.png` | Up into it: its entrance, on the mat. |
| `play-3-at-the-stairwell.png` | Round the guard posts to the floor beside the stairwell, captioned with where it goes. |
| `play-4-in-the-tunnel.png` | Pressing left goes down it: the north end of the tunnel, beside the stairs up. |
| `play-5-down-the-tunnel.png` | Halfway down, where the floor turns blue. |
| `play-6-at-the-far-stairs.png` | At the south end, beside the stairs up westward. |
| `play-7-up-in-the-other-entrance.png` | Pressing left goes up them, into the south hut's entrance beside its stairwell. |
| `play-8-out-of-the-other-hut.png` | And out of the south hut, south of the river. |

Taken from a `VITE_EPTW_TEST_MODE=pixels` build at 1200x768 by
`tools/playtest/makerPath.mjs`, which makes the path in the maker and walks all
of it key by key, the length of the tunnel included, checking each step. The
before shot is the same river on a build without the path, taken with
`--before`.
