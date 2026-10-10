# Gatehouses

The fifth step of linked areas (`docs/maker-areas.md`): FireRed's gatehouses,
each a building walked through from one side to the other with its room
between, so a wall of trees can have a way through it that is a place.

All three are FireRed's own, cut from pret's FireRed disassembly (provenance in
`public/assets/ASSET_PROVENANCE.md`): each building off the route it stands on,
by `scripts/cut-frlg-towns.mjs`, and each room off its own layout, by
`scripts/cut-frlg-areas.mjs`.

- **Gatehouse** - Route 2's, north to south. Up its steps into its door, up the
  room past the guards' tables, and out of the doorway in its back wall onto
  the ridge of its roof. It replaces the cut the maker had, which was taken
  from renders and had a tree's stray pixels on its roof and the path baked
  under it; it is the same building on the same footprint, so a map that has
  one keeps it.
- **Saffron gatehouse** - Route 5's, north to south, into the room with a
  counter down each side.
- **Saffron gatehouse, east-west** - Route 7's, gone into from the porch at
  either end. FireRed cuts its room with a column of dark down each side and a
  mat let into each side wall, hanging over the dark; a room may now be cut to
  its shape with the **Dark** brush.

As in FireRed, the ridge of the roof and the roof of each porch are drawn over
the player standing on them.

| | |
|---|---|
| `before-maker-route-gate.png` | Before: the Gatehouse chosen. Its doors were shut and it had no inside to make. |
| `maker-1-gatehouse-chosen.png` | After: the Gatehouse says it is walked through, and offers its inside. |
| `maker-2-inside-route-gate.png` | Route 2's gatehouse room: the doorway out north in the back wall, the runner to the mat, the palms, the guards' tables. |
| `maker-2-inside-saffron-gate.png` | Saffron's north-south room: a counter down each side. |
| `maker-2-inside-saffron-side-gate.png` | Saffron's east-west room: dark down each side, with a mat let into each and drawn over it. The room's brushes now include Dark. |
| `maker-3-side-mat-chosen.png` | A mat in a side wall, chosen: pressing left off it takes a player outside. |
| `maker-4-outside.png` | The map: two gatehouses in a row of trees across it, one in a column of trees down it. |
| `play-1-on-the-steps.png` | In play, on the steps of Saffron's gatehouse. |
| `play-2-in-the-gatehouse.png` | Up into its door: inside, on the mat. |
| `play-3-at-the-back-door.png` | Walked up the room to the doorway in the back wall, captioned with where it goes. |
| `play-4-on-the-ridge.png` | Out of it onto the ridge of the roof, facing north, the ridge drawn over the player's feet. |
| `play-5-on-the-porch.png` | At the east-west gatehouse's west porch. |
| `play-6-in-the-east-west-gatehouse.png` | Into it, onto the west mat, the dark beyond the wall either side. |
| `play-7-out-of-the-east-porch.png` | Across the room and out of the east mat onto the east porch. |

Taken from a `VITE_EPTW_TEST_MODE=pixels` build at 1200x768 by
`tools/playtest/makerGates.mjs`, which makes each gatehouse's inside in the
maker, then walks through each one key by key - up the steps, up the room, out
of the back door, and back; porch to porch across the east-west one, and back -
checking each step. The before shot is the same map on a build without
gatehouses, taken with `--before`.
