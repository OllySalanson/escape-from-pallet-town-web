# Every building has a way in

The fourth step of linked areas (`docs/maker-areas.md`): every building in the
maker that FireRed lets you into can now be given an inside, and a way through
is as wide as FireRed draws it.

Kanto's town buildings open where FireRed's own maps put their doors: the town
cutter (`scripts/cut-frlg-towns.mjs`) reads each town's warps out of pret's
FireRed disassembly as it cuts the buildings, so a Gym's door is the Gym's door
and the Bike Shop's is two cells wide under its awning, as in the game. Each
opens into the room it is - a Gym or the Dojo into a hall cleared for battling,
the Department Store and the Bike Shop into a shop, the Museum and the labs into
Oak's Lab - named for the building.

And as in FireRed, every cell of a wide door takes you in, onto the middle of
the mat - the one tile of it FireRed puts its arrow on, and the one that takes
you out again.

| | |
|---|---|
| `before-maker-bike-shop.png` | Before: the Bike Shop chosen. It has no door, so there is no inside to make. |
| `maker-1-bike-shop-chosen.png` | After: the Bike Shop offers MAKE ITS INSIDE. |
| `maker-2-inside-bike-shop.png` | Its inside: a shop, named for it. |
| `maker-2-inside-pewter-gym.png` | Pewter Gym's: the hall cleared for battling. |
| `maker-2-inside-museum.png` | The Museum's: Oak's Lab, as the base's own is laid out. |
| `maker-3-street.png` | The street with all three opened: each way in is marked across its whole width. |
| `play-1-at-the-shop-door.png` | In play, at the right-hand cell of the Bike Shop's door. |
| `play-2-in-the-shop.png` | Walked up into it: inside, on the mat. |
| `play-3-out-of-the-shop.png` | Out again by the middle of the mat, in front of the door's left-hand cell. Stepping down off the mat's side tiles goes nowhere. |
| `play-4-in-pewter-gym.png` | Into Pewter Gym. |
| `play-4-in-museum.png` | Into the Museum, up its steps. |

Taken from a `VITE_EPTW_TEST_MODE=pixels` build at 1200x768 by
`tools/playtest/makerBuildings.mjs`, which chooses each building, makes its
inside, then walks in and out of all three, checking each step - including
that the mat's side tile is only floor. The before shot
is the same street on a build without this step, taken with `--before`.
