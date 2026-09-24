# Every building in the base is a room you walk into

The harbour's four buildings used to be doorways straight onto a menu. Now each
one is a room, drawn in the FireRed/LeafGreen room it is dressed as. The keeper
stands inside, and the room shows what you have built:

| | |
|---|---|
| `yard.png` | The harbour, with Bill's new cottage at the head of the jetty. The keepers are no longer standing in the yard: they are inside. |
| `oaks-lab.png` | Professor Oak's Lab, from FireRed. The stretch of plain wall between the computers and the bookshelves is kept bare for the wall map (`OAK_WALL_MAP`). |
| `pokemon-centre-fresh.png` / `-built.png` | Nurse Joy's Center. A Poké Ball waits on her counter for every Pokémon she has to treat. Brock's two healing machines hang on the back wall once they are built, and the ward's bed stands where the Cable Club stairs used to go up. |
| `brocks-workshop-fresh.png` / `-built.png` | Brock's workshop, drawn from the Rocket Warehouse. It starts as bare floor and gets one object for every rung of his ladder: the radio set, the beacon's lamp, two lockers, two healing machines and the ward's monitors. |
| `bills-cottage.png` | Bill's house from FireRed, with the cell separators. The two empty shelf units either side of his desk are his cabinet of oddities, still to be filled (`BILL_CABINET_SHELVES`). |
| `pokemon-centre-smallest-stage.png` | The Center on the smallest screen the game supports (320x240). Every room fits on it and sits in the middle, in the dark, the way FireRed draws a room. |
| `oaks-lab-screen.png` | One key from the lab's door mat. |

## Re-kitting stays fast

Pressing the interact key on the door mat opens the keeper's screen without
crossing the room, and down off the mat leaves. A hint line along the foot of
the screen says both, but only while you are standing where they work. So the
only walk that costs anything is the walk across the yard, measured by
`src/game/base/baseWalks.ts` with the whole ladder built:

| from | Oak's Lab | Pokémon Center | Brock's Workshop | Bill's Cottage |
|---|---|---|---|---|
| the middle of the yard | 2 | 7 | 7 | 6 |
| the quay (home from a raid) | 6 | 11 | 11 | 4 |
| + walking up to the keeper (optional) | 3 | 4 | 1 | 2 |

The only yard walk that changed is going to Bill, and that one is the new door:
Bill used to stand two steps from the jetty, and his cottage door is four.

## How they were made

```sh
node tools/playtest/baseRooms.mjs <url> <dir> --built=all --hurt=4   # these photos, and the round trip
npx vite-node tools/base/renderBase.mts -- out.png 3 --room=brocks-workshop --built=all
npx vite-node tools/base/renderBase.mts -- out.png 2 --built=all --walks
```
