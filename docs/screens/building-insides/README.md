# Buildings you can walk into

The first rooms on a shipped map, both on the Floodplain (`src/game/world/buildingInsides.ts`).
Each is behind two buildings' doors that touch, one room inside, so no hunter
can shut it with one doorstep.

| | |
|---|---|
| `press-house-yard.png` | THE CIDER YARD: the press house and its store. One caption for both doors when both are on screen. |
| `press-house-inside.png` | Inside: the Rocket Warehouse's room, framed on black. The mat names where it comes out (THE CIDER YARD), and the hunter outside is OFF THE SCENT. |
| `press-house-out-of-the-store.png` | Stepped off the other mat: out of the store's door, five tiles along the yard, seen again. |
| `last-houses-street.png` | OLD TOWN's last two houses, above the drowned street. |
| `last-houses-inside.png` | Inside: FireRed's own house, with loot this raid seated on its floor. |

Taken in Canvas test mode (`?testmode=1`) with
`node tools/playtest/buildingInside.mjs <dev url> <out dir> [--inside=last-houses] [--port=N]`,
which walks in by one door and out by the other and prints what the hunter did.
The Floodplain's ground declares no tints, so a Canvas frame of it is the game.

These were taken when the door captions' arrows were typed `↑`, which Orange
Kid has no glyph for and which came out a `T`. The captions now point with the
filled triangles the battle cursor uses (`ui/pressArrows.ts`).
