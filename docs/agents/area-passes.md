# Taking an area to perfect: the ten passes

Read this before polishing any area - a district of Greystone Vale, a room, the harbour. It is the
standard THE HARBOUR was taken to on 14 Nov 2026 (`docs/screens/harbour-perfect/`), written down so
the next area is held to the same one. The owner's words that started it: "there's flowers on the
path and stuff ... some bits where they get all a bit muddled together ... I'd like you to just get
one area perfect."

One area at a time. Each pass is judged on a picture, not on the code, and gets a line on the
scorecard in the pull request with a before and an after. A pass that needed no change still gets
its line and its picture: it says what was checked.

## Before you start

1. **Draw the area as it stands** and keep the pictures: the whole of it (`renderBase.mts` for the
   harbour, `tools/mapcraft/world.mts` for a district) and the real game at the spots a player
   stands (`harbourTour.mjs --at=`, `walkableVillage.mjs --area=`), from a test-mode build of `main`.
   These are the "before" of every pass. Draw it again with `--collision --beats`.
2. **Walk it on the picture**, a 25x16 window at a time (the largest screen) and a 20x15 one (the
   smallest): from where a player arrives, to every door, and out again. Write down everything
   that looks wrong before fixing any of it. Most of what the passes below find is on that list.
3. **Keep what makes the place itself.** Everything is moved or given room, nothing authored is
   deleted, and nothing new is invented: no species, stats or music.

## The passes

| # | Pass | The question | What fails it | How to check |
|---|---|---|---|---|
| 1 | **Looks** | Does every tile belong where it is? | A flower, rock or prop on a path or a walking line; decoration half under a roof, a board or a crown; a path that gives out into lawn and starts again; an edge that ends in a stub; surf on dry ground; two grounds meeting with no reason | The whole-area picture at 3x, a window at a time. Random ground accents (`fillVariants`) are the usual culprit for things cut off: an area that plants its own flowers leaves the accent out of its grass |
| 2 | **Walkability** | Can two walk it side by side, in a straight line, without meeting anything? | Anything on the straight way; a door, sign or person a pair cannot reach; a pair sent further than one walker; collision that is not what the art shows | A 2x2 walker over the map with every figure on every tile of its beat (`harbourWalkable.test.ts`, `highMoor.test.ts`), and `walkableVillage.mjs` in the game |
| 3 | **Spacing** | Does each thing have its own room? | Two buildings sharing a wall that are not one place; something small wedged between two other things; a building standing on what is in front of it; a one-tile way into a part of the map | Ask it of the planted props (`harbourLooks.test.ts`, "its spacing"). Move or set back; never delete. A pile of cargo is one thing |
| 4 | **Finding your way** | Would somebody who does not read find the way out, the shop, the doors and the way home? | A door nothing leads to; a path that does not go where people walk; a keeper's building with nothing outside it that says what it is; a landmark hidden behind another | Follow the paths on the picture from the arrival tile: the ground itself should take you to every door that matters |
| 5 | **Flow** | Does arriving, doing what you came for and leaving feel like one walk? | A dead end with nothing at the end of it; one way in and out of a busy part; a detour round something that could stand a tile over | Trace the loops. Every dead end must end in something (a ship, a light, a game) |
| 6 | **Reward** | Is there something worth finding off the main path? | An area that is only its main path | List what is off the path and check each can still be reached and still says what it said |
| 7 | **Life** | Is something always moving, and does it stand where it makes sense? | A figure on a way; a figure that stares at a wall; a moved prop that left a figure looking at nothing; a quiet part with nobody in it | The `--beats` picture, then the game at day and at night. Sound effects yes; music stays off |
| 8 | **Danger and pace** | Are the threats where the player expects them, with calm between? | A fight on a doorstep; nowhere to breathe; (in the harbour) any threat at all | A raid area: where encounters, trainers and the hunter's ground sit against the safe spots. The harbour is safe by construction and must stay so |
| 9 | **Character** | Could this be nowhere else in the game? | Borrowed colours and materials; no one thing you would name it by | Name its materials and its signature feature in a line. If the line fits another area, it is not done |
| 10 | **Fit in the window** | Is what a newcomer needs in view when they arrive? | A key door a tile off the edge of the smallest screen; an arrival that looks at a wall | The 20x15 and 25x16 windows on every arrival tile (`harbourLooks.test.ts`, "what is in the window on arrival") |

## After each change

- Draw it again and look. A fix is judged on the picture it makes, and the first draft is rarely it:
  the harbour's bench moved three times and its cargo four.
- Re-run the area's walk test after every move. Spacing and walking pull against each other: the
  tidiest place for a stack of crates was the one tile a pair needed to reach the docks.
- A yard change re-plans every regular (`npx vite-node tools/base/botSpots.mts`), and a moved prop
  can leave a figure, a caption spot or a playtest route pointing at where it used to be.

## Done means

- Every pass has its scorecard line, its before and its after, under `docs/screens/<area>-perfect/`.
- What the pictures were judged by is held by a test, so the next change cannot undo it quietly:
  flowers only in beds, one unbroken path, nothing wedged, key doors in the arrival window.
- The area's doc under `docs/agents/` says what moved and why, and anything that describes the
  area (the front page, a library book, a notice) is still true.
- One real walk of the area in the game, at real speed, before reporting done.
