# THE HARBOUR, taken to perfect

The owner, 14 November 2026: "As well as walkability, there's also look and feel and spacing ...
just like in the harbour, there's flowers on the path and stuff. This sort of thing needs looking
at and going over and making like a good game. The other one is spacing: some areas just don't
really feel like they have enough space ... there's just some bits where they get all a bit
muddled together. I'd like you to just get one area perfect."

THE HARBOUR is that one area. It went through ten passes, each judged on pictures of the map and
of the real game, and each with a line on the scorecard below. The passes are written down as a
checklist for every other area in [`docs/agents/area-passes.md`](../../agents/area-passes.md).

Nothing authored was deleted: every building, sign, crate, barrel, post, flower bed, person and
Pokémon is still there, moved or given room. No species, stats or music were added.

## Scorecard

| # | Pass | Before | After | Held by |
|---|---|---|---|---|
| 1 | **Looks** | Eight flowers on KEEPERS' ROW's gravel; flowers the lawn put down by itself half under THE BATTLE ARENA's roof and between the DERBY board's legs; the gravel gave out into lawn and the stone started sixteen tiles later; surf drawn along the boardwalk's foot and down both sides of the pleasure pier, on dry sand; THE COVE's top row ended in a stub of lawn at each end | Every flower is in one of three planted beds, on lawn, in the open; one path from ARENA SQUARE to the end of THE PROMENADE; sand runs clean under the boards; THE COVE's edge is one soft line | `harbourLooks.test.ts`: its flowers, its paths |
| 2 | **Walkability** | A pair could already reach every door, sign and person, and walk straight east (the pass of 11 Nov). The ways with no door on them were walkable and nothing held them so | Unchanged in reach, measured both sides (table below), and now held: a pair is never sent the long way round to the docks, the long pier, THE COVE, the breakwater, the beach or the pier head. That test was written because the first draft of the spacing pass failed it: crates tidied against the warehouses' west wall stood on two of the three tiles the quay comes down to the docks by, and sent a pair round by THE COVE | `harbourWalkable.test.ts`: along the water, straight east |
| 3 | **Spacing** | THE MAST against THE BOLTHOLE's wall; the boutique sharing a wall with THE GREAT LIBRARY and standing on THE GREEN's fountain; the DERBY board's leg against THE BATTLE ARENA; a stack of crates wedged between the Arena's statue and Bill's cottage; barrels wedged between the mooring posts; barrels and a sack jammed between the second locker and the warehouses | Every building has its own walls (but THE GAME CORNER and its prize window, which are one place); nothing small touches two things; the cargo is at the warehouses' ends | `harbourLooks.test.ts`: its spacing |
| 4 | **Finding your way** | The way down from KEEPERS' ROW to the quay and the boat was a square of lawn; the way east was lawn between two paths; Bill's cottage had a crate stack hiding its wall | The gravel goes where the walk goes: down to the quay beside Bill's, and east across THE GREEN to the DERBY and the stone walk. Bill's has one barrel by its wall, clear of the statue. The Arena keeps its runner, banners and (on a first raid) its chevron | `harbourLooks.test.ts`: its paths |
| 5 | **Flow** | The loops were there: yard, quay, docks, THE COVE, THE GREEN and back; the front, the steps, the beach and back. Two of their joins were lawn: from KEEPERS' ROW down to the quay, and from the row across THE GREEN to the front | The same loops, joined by path. The three dead ends each end in something: the S.S. Anne and the captain's spyglass, the harbour light, the FISHING DERBY. No shortcut opens up in the harbour, and none was invented | `harbourWalkable.test.ts`, `harbourLooks.test.ts` |
| 6 | **Reward** | The bench looked at the back of a crate stack | The bench backs onto the path and looks over THE COVE, the jetty and the bay, with the old man who watches the boats beside it. Off the path as before: the spyglass (and its night sights), the angler's rod and his tally, Lapras singing at the breakwater after dark, the Magikarp in the cove | every one still reached two abreast (`harbourWalkable.test.ts`) |
| 7 | **Life** | Pidgey pecked on what is now the path; the old man stood under the Day-Care's fence looking at lawn | Pidgey is on the lawn by the bench, the old man beside the bench looking at the sea; everybody else keeps their beat; the regulars' standing spots were found again for the new yard | `harbourLife.test.ts`, `harbourBots.test.ts`, `harbourActivities.test.ts` |
| 8 | **Danger and pace** | None, by construction: no hunter, clock, encounter or loot | Unchanged, and it must stay so. The pace is in the ground: busy stone quay, quiet green, bright front | `baseMap.ts` is not a raid map |
| 9 | **Character** | Stone quay, two ships, a breakwater, a boardwalk with painted huts: nowhere else in the game | Unchanged in kind, and cleaner: the quay reads as stone, the row as gravel, the front as stone and boards, with no lawn between them | the pictures |
| 10 | **Fit in the window** | Not asked | On the smallest screen (20x15 tiles) a new visit sees the Arena's door, the Center's, the lab's and Bill's at once, and a raid come home sees the Arena's and Bill's; on the largest the four buildings are whole | `harbourLooks.test.ts`: what is in the window on arrival |

## What moved, and why

| What | Was | Now | Why |
|---|---|---|---|
| Flowers | Eight on the gravel in front of the Bolthole; four on THE GREEN; a dozen more wherever the grass's own accent fell | Three beds: under the Bolthole's window boxes, along the Day-Care's east fence, either side of THE GREAT LIBRARY's step. The harbour's grass no longer grows the accent | Never on a way, never half under a roof |
| KEEPERS' ROW's gravel | Ended at x 44 | Runs on to x 60, under the Day-Care's fence, to a stone apron under the DERBY board and the stone walk | One path under the walker |
| The way down to the quay | Lawn, x 18 to 21 | Gravel | The path goes where the walk goes |
| The Day-Care's pen | Rows 8 to 12 | Rows 7 to 11, against the wood | So the gravel runs straight under it |
| THE MAST | Against the Bolthole's east wall, in a notch of lawn | A tile clear of the house and of the pen, rising out of the wood | Its own walls |
| THE HARBOUR BOUTIQUE | Rows 4 to 7, on the fountain | Rows 3 to 6: a row of lawn in front of it | Its own front |
| THE GREAT LIBRARY | Sharing the boutique's wall | A tile east | Its own walls |
| THE BATTLE ARENA | Against the DERBY board | A tile east; the flower trough and THE GAME CORNER's sign moved round it | Its own walls |
| The bench | On the lawn above the crates, x 46 to 48 | Backing onto the path, x 50 to 52, over THE COVE | A view; and clear of the cargo |
| The crate stack by Bill's | Wedged between the Arena's east statue and the cottage | On the lawn's dead corner at the warehouses' east end, above the other stack | Nothing wedged |
| The barrels and the sack by the second locker | Jammed between the locker's door and the warehouses | One barrel against the warehouses' west wall, one by Bill's wall, the sack by the east warehouse door | Nothing wedged; a pair needs two of the three tiles down to the docks |
| The barrels at the long pier's foot | In the quay's corner, wedged between the corner post and the pier's two | Behind the warehouses' east end, beside the crates | Nothing wedged; the posts have the edge to themselves |
| The old man | Under the Day-Care's fence | Beside the bench, facing the sea | He watches the boats come in |
| Pidgey | Under the fountain | On the lawn east of the bench | Off the path, and off the way down to THE COVE |
| The beach | Drew surf against the boards | Runs on under them | Dry sand has no waterline |

## Pictures

Every pair is the same spot in the real game, the same save (every rung of Brock's ladder built), by day, at the 3x window.

### 1. Looks

| Before | After |
|---|---|
| ![flowers on KEEPERS' ROW's gravel, and the mast against the house](flowers-before.png) | ![the gravel clear and running on east, the flowers under the window boxes](flowers-after.png) |
| ![flowers half behind THE BATTLE ARENA's roof and between the DERBY board's legs; lawn between the gravel and the stone](front-before.png) | ![the front after: the path arrives at a stone apron under the DERBY](front-after.png) |
| ![the pleasure pier before: surf down both its sides and along the boardwalk's foot, on dry sand](beach-before.png) | ![the pier after: sand runs under the boards](beach-after.png) |

### 2. Walkability

| Before | After |
|---|---|
| ![what blocks, before](collision-before.png) | ![what blocks, after](collision-after.png) |

Red is solid and blue is a person's or a Pokémon's beat. Walked in the game by
`walkableVillage.mjs --area=harbour`: **no snag over 46 walks** (`snags-after.json`), as on `main`. Steps
two abreast and single file from where a raid comes home, by day with nothing built, measured
on `main` and here (the walk test's own measure):

| To | `main`: pair / one | Here: pair / one |
|---|---|---|
| The docks | 30 / 30 | 30 / 30 |
| The long pier | 23 / 23 | 23 / 23 |
| THE COVE's jetty | 47 / 46 | 47 / 46 |
| The breakwater | 60 / 58 | 60 / 58 |
| The beach | 66 / 64 | 66 / 64 |
| The pleasure pier's head | 82 / 81 | 82 / 81 |

A real-time walk on an unpaused loop: right held for thirteen seconds from where a visit starts
goes from 16,13 to 86,13, the far end of the stone, without a turn; left held brings it back to
the Arena's forecourt.

![midway along the straight way east, at real time](real-speed-east.png)

### 3. Spacing

| Before | After |
|---|---|
| ![THE GREEN's north before: the boutique against the library and on the fountain, the DERBY board against THE BATTLE ARENA](green-north-before.png) | ![after: each with its own walls, a row of lawn in front, beds either side of the library's step](green-north-after.png) |
| ![the forecourt's corner before: a crate stack wedged between the statue and Bill's cottage](landing-before.png) | ![after: a statue, a gap, a barrel and a cottage](landing-after.png) |
| ![the square's east corner before: barrels and a sack between the second locker and the warehouses](square-corner-before.png) | ![after: the locker stands alone, one barrel against the warehouses' wall](square-corner-after.png) |
| ![THE BOLTHOLE before: the mast against its wall](bolthole-before.png) | ![after: a tile of garden between them](bolthole-after.png) |

### 4. Finding your way

| Before | After |
|---|---|
| ![arriving before: lawn between KEEPERS' ROW and the quay](arrival-before.png) | ![arriving after: the gravel goes down to the quay beside Bill's](arrival-after.png) |

### 5. Flow

| Before | After |
|---|---|
| ![the whole harbour before](whole-harbour-before.png) | ![the whole harbour after](whole-harbour-after.png) |

### 6. Reward

| Before | After |
|---|---|
| ![the bench before, above a stack of crates](bench-before.png) | ![the bench after: the old man beside it, THE COVE and its jetty in front](bench-after.png) |

### 7. Life

| Before | After |
|---|---|
| ![THE GREEN before: Pidgey under the fountain, the old man under the fence](green-before.png) | ![THE GREEN after: both by the bench, off the path](green-after.png) |

After dark the children and the old man have gone home and the windows are lit, as before:

![THE GREEN at night, after](green-night-after.png)

### 8. Danger and pace

Nothing to picture a threat with: there is none in the harbour. The quiet end, before and after:

| Before | After |
|---|---|
| ![THE COVE before](cove-before.png) | ![THE COVE after](cove-after.png) |

### 9. Character

| Before | After |
|---|---|
| ![the docks before](docks-before.png) | ![the docks after: cargo at the warehouses' ends](docks-after.png) |

### 10. Fit in the window

The smallest screen the game presents (20x15 tiles):

| Before | After |
|---|---|
| ![a new visit on the smallest screen, before](small-arrival-before.png) | ![a new visit on the smallest screen, after](small-arrival-after.png) |
| ![a raid come home on the smallest screen, before](small-landing-before.png) | ![a raid come home on the smallest screen, after](small-landing-after.png) |

## How they were made

- The whole-harbour pictures are `npx vite-node tools/base/renderBase.mts -- <out> 1 --built=all`, on
  `main` before this change and after it; the collision ones add `--collision --beats`.
- The in-game pictures are `harbourTour.mjs --built=all --clock=day
  --at=landing:12:19,flowers:40:14,green:53:14,green-north:59:10,front:66:14,square-corner:33:18,docks:40:21,bench:50:16,cove:54:19,beach:78:20`
  (the arrival and the Bolthole pictures are its `spawn` and `outside-bolthole`), the smallest-screen
  ones add `--window=960x720`, and the night one `--clock=night`: against two test-mode builds
  (`VITE_EPTW_TEST_MODE=1 npx vite build`), one of `main` and one of this change, served under
  `/escape-from-pallet-town-web/` and driven in headless Chromium, one browser at a time.
- The snag list is `walkableVillage.mjs --area=harbour` against the build of this change.
- The real-time walk held the arrow keys for real seconds on that build's unpaused loop
  (`?testmode=pixels`). It was not made on a plain URL: a page out of test mode joins the live
  shared harbour (`harbour/harbourWire.ts`), and a check never talks to it.
- `docs/readme/harbour.png`, the front page's picture of the harbour, was taken again the way
  `docs/readme/README.md` says (`harbourTour.mjs --built=all --clock=day --window=1600x1024`, off
  the quay).
