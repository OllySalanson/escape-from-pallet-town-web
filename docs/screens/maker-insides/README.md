# Going inside a building

The captain, on the map maker (2026-10-10): *every building in the map maker the
user should have an option to customise the inside of the house and then it
takes them inside the building.* This is the first step of that, and the ground
the caves and the warps are built on (`docs/maker-areas.md`).

Before, a house's open door was a pocket you stepped into and nothing happened
(`before-play-door.png`), and the maker had nothing to say about a building but
that it could be moved (`before-maker-house-chosen.png`).

| | |
|---|---|
| `maker-1-house-chosen.png` | A house with a door, chosen: its door is shut, and MAKE ITS INSIDE gives it one. |
| `maker-2-inside.png` | The inside, furnished as FireRed furnishes a house, opened in the editor: its own brushes (floor and wall), its own furniture, its own name, look and size, and a strip of the map's places above it. |
| `maker-2b-furniture.png` | The room's furniture, each piece pictured on the room's own floor. Every piece is cut from one of the base's FireRed rooms with that room's floor in it, so a room offers its own style's pieces and the ones cut clean. |
| `maker-3-mat-chosen.png` | The mat is the way out; choose it to see where it leads, drag it along the wall to move it. |
| `maker-4-outside-again.png` | Back outside. The tile in front of the door is marked with the way you press to go in. |
| `play-1-at-the-door.png` | WALK IT, standing at the door. |
| `play-2-inside.png` | Pressed up into it: the screen goes dark and comes back on the room, on black the way a FireRed room is, standing on the mat. The plate says HOUSE; the caption over the mat says where pressing down goes. |
| `play-3-out-again.png` | Pressed down off the mat: back in front of the door, facing away from it. |
| `templates.png` | The sample with a Pokémon Center, a Poké Mart and a Gym added and every inside made: the outdoors, and each inside laid out beside it in the one grid the raid is played on, as `renderMap.mts --file=` draws it. |

Taken from a `VITE_EPTW_TEST_MODE=pixels` build at 1200x768 by
`tools/playtest/makerAreas.mjs`, which checks each step as it photographs it.
