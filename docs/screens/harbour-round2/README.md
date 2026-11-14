# THE HARBOUR, round two: where the buildings stand, and how full it is

The owner, 14 November 2026, of the harbour the ten passes left
([`docs/screens/harbour-perfect/`](../harbour-perfect/README.md)): "I think we need better
building placement as well on the harbour, also like now it looks a little bit sparse as well."

So THE HARBOUR went round again, on two new passes - **building placement** and **density** -
keeping every line of the first scorecard. Both are in the checklist every area is taken through
now ([`docs/agents/area-passes.md`](../../agents/area-passes.md), passes 11 and 12).

Buildings moved, not only props: the warehouses, THE HARBOUR BOUTIQUE, THE GREAT LIBRARY and the
long pier with the S.S. Anne. Nothing authored was deleted: every building, sign, crate, barrel,
sack, post, flower bed, person and Pokémon is still there. No species, stats or music were added;
the new people are two FireRed townsfolk with something true to say.

## Scorecard

| # | Pass | Before | After | Held by |
|---|---|---|---|---|
| 11 | **Building placement** | The quay had no front: Bill's cottage at one end, the warehouses two rows nearer the water with a lawn nobody walked behind them, and nothing else. The boutique was set into the trees at the top of THE GREEN, five rows from any path. THE GREAT LIBRARY shared that notch, off the lawn's line, behind the DERBY's board. HARBOUR SQUARE was open on three sides and its fountain was a tile off the long pier's line. KEEPERS' ROW had one side | One building line along the quay - Bill's, HARBOUR SQUARE, the warehouses, the boutique - backs to the row, doors to the water, the quay three deep under all of it. The warehouses' gable closes the square; the square's way out is between two lamps on the fountain's line, and the long pier and the S.S. Anne are on that line too. A second lane comes down from the row between the warehouses and the boutique. The library stands alone at the head of THE GREEN, square to its fountain. Trade is on the quay, the keepers on their row, home beside the Day-Care, the games on the front | `harbourLooks.test.ts`: where its buildings stand |
| 12 | **Density** | 11% of the town's open ground was three steps or more from anything (8% with every rung built): the lawn between the row and the cove, the quay, the docks five deep. Nothing on the water but the two ships | 5% (3% built), and what is left is the middle of a way and the clearings Brock builds in. A fish stall against the warehouses with its keeper, a Meowth, a crate of fish and a drying net; seven rowing boats, six of them riding the swell at the quay wall; lobster pots, an anchor and a coil of rope at the water's edge; lamps and planters; benches on the front; THE TRADER's stock beside him; a gardener at the library's beds. 23 more things planted, none of them on a way | `harbourLooks.test.ts`: how full it is; `harbourWalkable.test.ts` |

And the ten from round one, each asked again of the new layout:

| # | Pass | Now |
|---|---|---|
| 1 | **Looks** | Flowers still only in planted beds (the library's moved with it); one path from ARENA SQUARE to the end of THE PROMENADE, unchanged; a second gravel lane, and stone aprons up to THE GAME CORNER's arch and the prize window's door. The wood is closed behind the DERBY's board and between THE BATTLE ARENA and THE GAME CORNER, where a strip of lawn led nowhere |
| 2 | **Walkability** | Every door, sign, landmark, fixture and person reached two abreast, by day and night, nothing built and everything (table below). The quay is one straight walk from the jetty to THE COVE now: it came down to the docks by three tiles round the pier's foot |
| 3 | **Spacing** | Every building its own walls (the stall is the warehouses' lean-to, as the prize window is the arcade's); every pile against one wall; nothing wedged, fishing gear included |
| 4 | **Finding your way** | The boutique's door is on the quay you already walk; the lane beside it is gravel from the row. The S.S. Anne is at the end of the view through the square |
| 5 | **Flow** | A third loop: row, lane, quay, square and back. The quay no longer jogs round the warehouses |
| 6 | **Reward** | Off the main path now: the fish stall and its Meowth, the net, the boats to look down at, the bench over THE COVE (moved with its old man), the sandcastle |
| 7 | **Life** | 28 people and Pokémon by day (26): a FISHMONGER and a GARDENER. The dock worker and his Machop stack crates on the wharf; the little girl is on THE PROMENADE's beach by her sandcastle; the regulars' spots were found again |
| 8 | **Danger and pace** | None, by construction. The pace is still in the ground: busy quay, quiet green, bright front |
| 9 | **Character** | More of it: a quay front with a fish stall and boats at the wall could be nowhere else in the game |
| 10 | **Fit in the window** | Unchanged: the Arena's door, the Center's, the lab's and Bill's in the smallest window on arrival |

## What moved, and why

| What | Was | Now | Why |
|---|---|---|---|
| The warehouses | Rows 16 to 19, a lawn behind them | Rows 14 to 17, on Bill's building line, their gable against HARBOUR SQUARE | A quay front; the row gets a second side; the square gets a wall |
| THE HARBOUR BOUTIQUE | In the trees at the top of THE GREEN | On the quay front past the warehouses, its door to the water | Trade by the quay; a door on a way. 46 steps from the yard and 56 from the boat became 39 and 41 |
| THE GREAT LIBRARY | East of the lawn's line, sharing the notch, behind the DERBY's board | Alone at the head of THE GREEN, its door on the fountain's line, two rows of lawn between | A building square to its lawn, with nothing in front of it |
| The long pier, its sign, the S.S. Anne, her captain | Walkway at x 28 to 30 | x 27 to 29 | On the fountain's line: the ship ends the view from the row |
| The docks | Five deep under the warehouses, down a three-tile neck | The quay, three deep, straight from the jetty to THE COVE; the wharf the pier leaves from keeps its corners | No bare paving; boats close under the stall |
| THE COVE | 13 tiles of sand | 7, past the boutique | The rest is the boutique's quay. The derby's west line moved in with it (levels 2 to 4; THE FRONT is untouched) |
| The lawn between the row and the cove | Empty but a bench | A lane, the boutique, and the bench's lawn over THE COVE | It was the sparse part |
| The cargo | At the warehouses' ends | Two barrels against the warehouses' gable in the square; a stack on the wharf with the dock worker; a stack, the sack and a barrel beside THE TRADER | Each pile against one wall, off every way |
| A mooring post | On the quay's corner | A row down, on the wharf's | With the square's planter it shut the quay to a pair |
| THE PROMENADE's sign | On the lawn over THE COVE | Against THE BATTLE ARENA's corner, where the stone walk starts | It is read from the walk it names |
| The little girl, the Psyduck, the Krabby, the warden, the old man, Pidgey, the Meowth, the dock worker, the Machop | Round the old cove, lawn and docks | With what they belong to: the beach, the water's edge, the bench, the stall, the wharf | A moved building takes its people with it |

## Measured

Steps two abreast / single file, by day with nothing built (the walk test's own measure):

| To | From the boat: `main` | here | From the yard: `main` | here |
|---|---|---|---|---|
| The quay under the warehouses | 30 / 30 | 30 / 31 | 31 / 32 | 29 / 31 |
| The long pier | 23 / 23 | 24 / 24 | 24 / 25 | 23 / 24 |
| THE COVE's jetty | 47 / 46 | 44 / 44 | 43 / 44 | 43 / 44 |
| The breakwater | 60 / 58 | 58 / 56 | 56 / 56 | 56 / 56 |
| The beach | 66 / 64 | 64 / 62 | 62 / 62 | 62 / 62 |
| The pleasure pier's head | 82 / 81 | 80 / 79 | 78 / 79 | 78 / 79 |
| THE HARBOUR BOUTIQUE | 53 / 55 | 40 / 40 | 43 / 45 | 38 / 38 |
| THE GREAT LIBRARY | 60 / 62 | 56 / 58 | 50 / 52 | 46 / 48 |

The walks taken every raid are what they were: the Raid Arena 9 from the yard and 11 from the
boat, Bill 4 from the boat, the Center 5, the lab 11, the workshop 17.

| | `main` | here |
|---|---|---|
| Open ground three steps or more from anything, nothing built | 11.2% | 4.8% |
| The same, every rung built | 7.8% | 3.1% |
| Furthest any open ground is from something | 4 steps | 4 steps |
| Things planted (not trees), every rung built | 107 | 130 |
| People and Pokémon by day | 26 | 28 |
| Boats on the water | 2 ships | 2 ships and 6 rowing boats, and one on the sand |

## Pictures

Every pair is the same spot in the real game, the same save (every rung of Brock's ladder built),
by day, at the 3x window, unless it says otherwise.

### The whole harbour

| Before | After |
|---|---|
| ![the whole harbour before](whole-harbour-before.png) | ![the whole harbour after](whole-harbour-after.png) |

### 11. Building placement

| Before | After |
|---|---|
| ![the docks before: the warehouses, five rows of paving and the sea](quay-front-before.png) | ![the quay front after: the fish stall against the warehouses, the boutique past the lane, boats at the wall](quay-front-after.png) |
| ![the boutique before, in the trees at the top of THE GREEN with the fountain at its door](boutique-before.png) | ![the boutique after, on the quay with a lamp and a planter at its front](boutique-after.png) |
| ![THE GREEN before: the boutique where the library's line is, the library off to the east behind the DERBY's board](green-before.png) | ![THE GREEN after: the library alone at its head, on the fountain's line](green-after.png) |
| ![HARBOUR SQUARE before: open to the quay, the pier a tile off its line](square-before.png) | ![HARBOUR SQUARE after: two lamps and two planters, and the long pier straight ahead](square-after.png) |
| ![KEEPERS' ROW east of the square before: lawn to the south of it](row-before.png) | ![after: the warehouses' and the boutique's roofs across the street, a lane between them](row-after.png) |

### 12. Density

| Before | After |
|---|---|
| ![coming home before](landing-before.png) | ![coming home after: rowing boats, lobster pots, a coil of rope](landing-after.png) |
| ![THE COVE before: thirteen tiles of sand](cove-before.png) | ![THE COVE after: half the width, the boutique's quay beside it](cove-after.png) |
| ![arriving before](arrival-before.png) | ![arriving after: THE TRADER's stock beside him](arrival-after.png) |
| ![THE GAME CORNER's front before: lawn between the walk and its doors](front-before.png) | ![after: aprons, benches, and a hedge closing the gap beside it](front-after.png) |
| ![the beach before](beach-before.png) | ![the beach after: a sandcastle and the girl who built it](beach-after.png) |

After dark the stall's keeper is still at it, the windows are lit and the lamps are on. They
were not before: a lamp's head was washed dark with a box of the wash round it (the boardwalk's
four on `main`), and is left lit now with a pool of light under it.

![the quay front at night](quay-front-night-after.png)

### Still walkable, still in the window

![what blocks, after](collision-after.png)

Red is solid and blue is a person's or a Pokémon's beat. Walked in the game by
`walkableVillage.mjs --area=harbour`: the result is `snags-after.json`.

The smallest screen the game presents (20x15 tiles), arriving and coming home:

| A new visit | A raid come home |
|---|---|
| ![a new visit on the smallest screen](small-arrival-after.png) | ![a raid come home on the smallest screen](small-landing-after.png) |

## How they were made

- The whole-harbour pictures are `npx vite-node tools/base/renderBase.mts -- <out> 1 --built=all`,
  on `main` before this change and after it; the collision one adds `--collision --beats` at 2x.
- The in-game pictures are `harbourTour.mjs --built=all --clock=day
  --at=landing:12:19,square:28:18,row:44:13,quay-front:41:19,green:57:7,cove:56:19,front:77:13,beach:72:21`
  (the arrival and the boutique pictures are its `spawn` and `outside-boutique`; `main`'s
  quay-front picture is `--at=quay-front:40:21`, because 41,19 was inside a warehouse), the
  smallest-screen ones add `--window=960x720`, and the night one `--clock=night`: against two
  test-mode builds (`VITE_EPTW_TEST_MODE=1 npx vite build`), one of `main` and one of this
  change, served under `/escape-from-pallet-town-web/` and driven in headless Chromium, one
  browser at a time.
- The figures in "Measured" are the walk test's own search and the looks test's own count, run
  over `getBaseMap()` on both sides.
- A real-time walk on an unpaused loop (`?testmode=pixels`, keys held for real seconds): from the
  jetty a step up, east along the quay past HARBOUR SQUARE to the wharf (22 tiles in 3.6s), a step
  down, east past the fish stall and the boutique to THE COVE (23 tiles in 3.8s), back up the
  lawn to KEEPERS' ROW, down the new lane and up it, and west along the row to where a visit
  starts: 19.9 seconds, never stopped by anything. It was not made on a plain URL: a page out of
  test mode joins the live shared harbour, and a check never talks to it.
- Played end to end on the build of this change: all four levels of THE PROMENADE DERBY
  (`derbyLevels.mjs`: the three that finish on THE COVE's sand have a new west line), THE HARBOUR
  BOUTIQUE (`boutique.mjs`), THE GREAT LIBRARY (`greatLibrary.mjs`), the regulars
  (`harbourRegulars.mjs`), the haul on the quay (`haulQuay.mjs`) and the harbour's favours
  (`harbourFavours.mjs`, which walks up to the warden and the captain where they stand now).
- `docs/readme/harbour.png`, the front page's picture of the harbour, was taken again the way
  `docs/readme/README.md` says.

## Found on the way, and fixed

- **THE COVE's Krabby was never drawn.** It shared the id `beach-krabby` with THE PROMENADE's, and
  the scene keeps its figures by id, so the cove's held its tile (solid, and in every walk test)
  with nobody standing on it. Every "before" picture of THE COVE here shows the empty tile east of
  the Psyduck. It is `cove-krabby` now, and `harbourLife.test.ts` holds every id to one figure.
- **A lamp went dark at dusk, in a dark square.** Anything drawn above the figures is washed again
  at night, and a brim (a lamp's head, a crown's top) was washed as a box, darkening the ground
  behind it twice and anybody under it. A brim is washed through its own art now, and a lantern
  is left lit (`HarbourNight.washBrims`), which THE PROMENADE's sign always said it was.
- **A Pidgey on the way off the boardwalk**, found by `walkableVillage.mjs` on the first draft of
  this change and held now by the walk test's boardwalk row.
