# The hunters

What the hunters are, why, and the numbers they were tuned to. The rule is
`src/game/world/hunterPack.ts`; the scene that draws it is `WorldScene`
(`advanceHunterPack`, `drawHunterPack`, `catchByPack`, `settlePackAfterFight`).

## What the captain asked for

> "maybe there should be a hunter in each area ... If you get out there the
> hunter stops chasing you I guess unless it's right on your tail ... if you
> lose it then it goes back to its own one"

> "they should just chase you down and you can like run at the same speed as
> them and like maybe just sometimes they get stuck behind something for like
> one turn ... to give you a chance to kind of like get away a bit ... just
> about escaping out of one area but getting into another and then there's
> another one there ... forcing me to run across some grass and I think I'm
> going to make it but then I hit a battle in the grass"

## What it replaced

One hunter a raid, dropped five walking steps from the player at a minute in,
that hunted them by shortest path from that frame on and moved one step for
every step they took (plus one every six seconds they stood still). It had no
place - it was always next to you - nothing could be outplayed (it never lost
a step and never lost you), and a wild fight cost the chase nothing. The only
ways out were to beat it or flee its fight for raid clock. A raid with a
friend still shares that hunter (`raidRoom/groupHunter.ts`).

## The rules

| | |
| --- | --- |
| **Where** | One hunter to every district at least 32 tiles each way that no bigger one holds (Greystone Vale's nineteen); the whole outdoors on a map with none. Each walks a loop of five corners of its patch at a stroll (330 ms a tile), pausing to look round at each. |
| **Who** | The raid's own rival keeps the district the raid lands in; the five turn about across the map so no two neighbouring districts share a face. |
| **When** | They come out together at the old arrival time (60 s, sooner on a high-pressure contract; never before the player has set off), each on the corner of its loop furthest from the player and at least 12 tiles off - never in sight. The arrival sting and the edge pulses say so; nobody is named until one sees you. |
| **Noticing** | A cone ahead (as far to the side as ahead) 7 tiles deep, and all round within 2 (hearing), never through anything solid but water, a ford, a fence or ice. In tall grass you are seen only within 2. Seen: FireRed's "!" over it, the "!" sting, the chip shouting `MISTY ON YOUR TAIL`, and a 0.4 s beat before it runs - about three of your steps. |
| **The chase** | Real time, at your walking pace (150 ms a tile), on the raid clock: stop to read, search, bump a wall or stand still and it gains a tile every 150 ms; walk and it does not gain at all. Once after you it sees all round to 12 tiles, and keeps track of you for 0.75 s after you go out of sight - one corner is never enough. |
| **The snag** | The one break the chase gives, never by chance: after 3 straight tiles at full pace, a turn forced by something solid ahead costs it a tile (it shakes on the spot, with a scuff), at most once every 6 tiles. Open ground is its ground; a wood, a fence line or a town is yours. |
| **Losing it** | Out of sight and past its tracking, it runs to the last tile it saw you on and looks about for 1.5 s (a quarter-turn at a time, all round, 12 deep) with a green "?" over its head, then walks home and the chip says `MISTY LOST YOU`. Out of its own district it gives up the moment it cannot see you. |
| **Areas** | It follows you out of its district only while it is right on your tail (within 4 steps); otherwise it stops at the edge and walks home. The next district's hunter is the next problem. |
| **Fights it is not in** | The world stops for a fight as ever. Coming out, every hunter that was after you heard it: it knows where you are and comes on 2 steps, but never into touching distance, so you always have a step to answer. |
| **Caught** | A hunter after you that stands beside you while you are at rest (never under a box) catches you: the same catch beat, that rival's lines and team. Walking into any hunter is being caught by it. |
| **Fleeing** | Unchanged: always works, costs raid clock, throws it back behind you (`findHunterBreakawayTile`, never across the only way out), blind and solid for 20 s - then it walks home and has to see you again. |
| **Beaten** | Gone for the raid. The enrage brings the keeper of the district you are in back once. |
| **The enrage** | The last 15 s: every hunter within 40 tiles knows where you are, gives up nowhere and runs at twice your pace. |

### Wild battles while fleeing

A tall-grass fight mid-chase is the gamble the grass offers: it hides you from
sight past two tiles, and it rolls for wildlife. The world is paused through the
fight (the clock does not run), so the hunter does not move while you fight and
can never start its own fight on top of yours. What the fight costs is ground:
coming out of it, every hunter that was after you knows where you are and comes
on up to two steps, but stops short of touching you. So a fight never becomes a
trap you cannot answer - you come out with a step to run, and if it catches you
anyway its fight can always be fled - but it is the moment the chase you thought
you had won turns round.

## Measured

`npx vite-node tools/hunter/chase.mts` plays chases on the real vale: a player a
hunter has just seen, five steps off, walking away to somewhere 40-90 steps off
at walking pace, every tall-grass step rolling a fight at 10%.

400 chases a row, 29 Oct 2026:

| the player | caught | shook it off | of which by leaving its district | still chased on arrival | closest gap (steps) | snags a chase |
| --- | --- | --- | --- | --- | --- | --- |
| never stops, no grass fights | 0% | 64% (in 4.9 s) | 52% | 36% | 6.2 | 1.0 |
| never stops, grass fights at 10% | 0% | 54% (4.9 s) | 50% | 46% | 5.2 | 1.0 |
| never stops, grass fights at 20% | 0% | 46% (4.6 s) | 43% | 55% | 4.2 | 1.0 |
| stops 0.5 s every 25 steps | 23% (in 8.2 s) | 40% | 34% | 37% | 3.0 | 0.9 |
| stops 1 s every 25 steps | 55% (7.5 s) | 29% | 23% | 17% | 2.0 | 0.7 |
| stops 2 s every 25 steps | 72% (4.8 s) | 28% | 21% | 1% | 2.2 | 0.7 |

Read it as the captain's sentence. Same speed: a player who never stops is
never caught, and nothing on open ground gains them a tile. The chances to get
away are the snag (about one a chase), breaking sight, and the edge of its
district (about half of all escapes). What gets you caught is everything you
stop for - a box, a crate searched, a wall bumped - and a fight in the grass
brings it two steps closer and back on your trail, which is why a grassy run
leaves you still chased more often. The harness walks perfect shortest paths,
so a real player, who bumps and hesitates, sits nearer the rows that stop.

Frame cost, from `tools/playtest/hunterPack.mjs` on a test-mode build in
headless Chromium (software WebGL, a machine at load 10-13), the same 100-step
route walked with no hunters out and then with four hunters chasing:

| | no hunters | four chasing |
| --- | --- | --- |
| the pack's own work a frame (mean / 95th / worst) | 0.03 / 0.1 / 0.9 ms | 0.17 / 0.6 / 2.7 ms |
| the player's pace | 6.8 tiles/s | 6.7 tiles/s (a walked tile is 150 ms: 6.67) |

The whole frame (update and draw) moved by about 2 ms of a headless frame that
is 14-17 ms either way, of which the pack is 0.2; frame intervals in headless
software rendering on a loaded machine swing by a third between identical runs,
so they are not the measure. Hunters further than 40 tiles off hold still,
the pack's searches reuse their arrays, a walk home or round its loop is
searched once, and the world view it reads is built only when a hunter asks.

## Captain's calls left open

- Should a hunter's cone be drawn on the ground, as a trainer's watch is? Today
  you read it from the way it faces.
- Should a raid with a friend move to the pack too? It still shares the one
  step-locked hunter.
- Should caves and rooms have hunters of their own? Today only a hunter on your
  tail follows you in.
