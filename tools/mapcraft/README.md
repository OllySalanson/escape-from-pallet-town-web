# mapcraft

Tools for drawing a raid map the way that worked: a short **map program**
written district by district, checked hard, measured against what FireRed's
own mappers do, and looked at as the game draws it before every edit.

They come out of the map research of 12 October 2026 (rounds 1-3). The short
version of what it found:

- The art is not what makes a map look hand-made: FireRed's own routes drawn by
  this game's builder in this game's tiles look like FireRed. The layout is.
- A layout written as a program and fixed by looking at its picture beat every
  other way an AI drew a district (typing tiles, image models, search, stitching
  real pieces).
- Written to the **pattern language** below, a district scored where real
  FireRed routes score when both were judged blind in the same tiles, and in a
  blind test the owner could not reliably tell them apart. What still gives an AI map
  away is restraint: it fills every screen, and it gives every district the
  same idea.

Nothing here is part of the game build: it is node tooling that imports the
game's own map format, checks and renderer, so it can never disagree with them.

## How to use it

```sh
npx vite-node tools/mapcraft/look.mts -- tools/mapcraft/examples/viridianSouth.ts out/viridian-south
```

That compiles the program, prints the hard checks, the design moves and the
pattern-language advice, and writes:

| File | What it is |
|---|---|
| `out/viridian-south.json` | the map file: open it in MAKE A MAP, play it with TRY IT |
| `out/viridian-south.png` | the district as the game draws it |
| `out/viridian-south.grid.png` | the same with tile numbers, so a critique can name tiles |
| `out/viridian-south.moves.png` | the same with the design moves washed in colour (below) |

It exits non-zero when a hard check fails. The round that works is:

1. **Plan before drawing.** Write down the skeleton: where the road runs and
   what each end reaches, what the ledges are for (the quick way back), where the
   border is, and the one thing worth seeing in each screen (about 15x10 tiles).
2. **Write the program**, one decision a line, with a comment saying why.
3. **Look.** Run `look`, read the hard checks, then open `.grid.png` beside a
   real route and `.moves.png` beside the advice.
4. **Fix the three worst things**, and look again. Every district in the
   research had three rounds.

A program is a module whose default export takes a seed and returns a
`MapcraftResult` (`report.ts`): the map file, the part of it the program drew
(when it draws under a shipped map's edge, as the example does) and the
district's brief as walking rules. `examples/viridianSouth.ts` is the worked
example: Viridian City's south district under the shipped town, which it reads
back from the game with `shippedRows` and locks.

## Writing a program

`MapProgram` (`program.ts`) is a grid of the map file's own ground letters plus
planted buildings. Strokes overwrite earlier strokes except on `lock`ed tiles.

| Brush | What it does |
|---|---|
| `meadow`, `wood`, `rock`, `block`, `draw`, `put` | ground by rectangle, by rows of letters, by tile |
| `road`, `trail`, `river` | straight legs, two wide (a one-tile lane draws with a cut edge on this sheet) |
| `bed`, `bedRows`, `pond`, `blob` | tall grass and water; `bedRows` draws ragged edges row by row |
| `ledge`, `terraces` | a ledge hops south and cannot be climbed; terraces are short stacked pieces |
| `fenceLine`, `yard`, `bushes`, `flowers` | fences as structure, a fenced yard with gates, single tiles |
| `building(kind, x, y)` | plants a building by the file's own word, on a lot its real size |
| `frame` | a deep, ragged border |

`compile` (run by `toFile`) does what no program should have to remember: every
2x2 lattice cell of wood is whole (a half tree draws as a stray bush), no tree
grows onto a building's lot, and every ledge run gets its two ends. The lattice
starts at (0, 0), so a district meant to join a bigger map starts on an even tile.

## The checks

**Hard checks** (`checks.ts`) are what a map has to pass: the game's own ten
(`checkMapFile`, the same the map maker and the publish workflow run), then
*every tree is whole*, *every open tile can be walked to*, and the brief's
walking rules (`reach`, and `shortcut`: the ledges save at least so many steps).

**Advice** (`patterns.ts`) is never a gate - the only gate on a map is whether it
works. Each item names a move, what the map does and what FireRed's routes do:

| Move | Asks | FireRed routes |
|---|---|---|
| A road you can see, that goes somewhere | road share of the walkable ground | 37% |
| Restraint: open ground left on purpose | the biggest open patch, neither tiny nor dominant | about 19% |
| Small and full, not big and empty | plain lawn share | 42% |
| Ledges are short pieces | median ledge piece | three to six tiles |
| Every ledge ends against something | pieces anchored at both ends | |
| Ledges stack into terraces | pieces sitting over another of the same span | 60% |
| A ledge needs a job, or it goes | every hop saves four steps or more | |
| A thick, ragged border | border depth | 5 |
| Fences are structure | fence runs | about 5 |
| Never the same copse twice | clumps of three trees or more with an identical shape | |
| Nothing stray; nothing ruled or stamped | lone solid tiles; repeated 6x6 windows | |
| Paths go somewhere | road ends that stop in the open | |

The FireRed figures are medians over the 23 FireRed routes of the pret
decompilation (pokefirered at 037335f), measured by `measures.ts`. Two moves no
code checks, and they are what the judges said the AI maps still lack: **one
idea per route** (a mountain pass, a cycling road out of a gate, a cottage at the
end of a cliff path) and **something worth seeing in every screen**.

`.moves.png` washes the moves over the picture: blue the border, orange the
road, pink plain lawn, green tall grass, purple what stands in the open, red
outline ledges, white outline fences. Pink everywhere and no orange is the look
of a generated map.

## The pattern language, in full

Twenty-three moves, each with its sources: PokeCommunity Daily and Eevee Expo
mapping tutorials, a review of Game Freak's leaked Gold/Silver drafts against the
shipped maps ("Whoever placed the ledges in the original version needs to be
fired"; the shipped Ecruteak has "75% fewer ledges"), translated Game Freak
interviews, The Level Design Book, the Cassette Beasts dev blog, and the
procedural games that reported what finally looked hand-made. The five every
source agrees on, in order:

1. **Ledges with a job.** The ledge is the quick way back that skips the grass
   ("force the player into tall grass on their first trip, but allow them to
   skip it on the return journey"); short pieces stacked into terraces, each
   ending against something.
2. **Paths that go somewhere**, bending round big things, never stopping dead.
3. **Woods as masses with ragged edges**; copses of one or two trees; never the
   same clump twice ("I never clumped more than two of the large trees together").
4. **Small and full, not big and empty** ("don't try filling the map with
   objects": shrink it), with something worth seeing on every screen.
5. **Nothing ruled** ("perfect symmetry and repetition give your maps an
   artificial look, as if designed by a robot or a bored programmer's algorithm").

## Judging a map

Score maps blind, in the same tiles, one map at a time, with Opus, and with
deliberately broken real routes in every batch (blocks swapped, shuffled,
randomised): a judge that rates a broken route above a real one is discarded.
Ask for observations (the paths, the edges and ledges, what stands in the open)
before the score. What the research measured about judges:

- They reliably catch broken maps, and often recognise Game Freak's own routes,
  but cannot rank one good map against another: the same real route scored
  anywhere from 4 to 8 between batches. A person's eye is the judge of "human
  grade".
- A "which of these two is real" test inside one conversation leaks: judges work
  the answers out from repeats, from a shared brief, or from converter
  artefacts, and judge provenance rather than quality.
- Small classifiers trained on the real maps separate ours from theirs easily -
  by proportions (more road, less lawn), not layout: they call scrambled real
  routes real. Useful as a checklist, never as a target.

## A huge map

A huge map is planned coarse and drawn a district at a time, so it can grow
without anything already drawn moving:

1. **The world plan** (`worldPlan.ts`): districts on a grid of equal squares,
   each with **one idea** written down, and the **crossings** where a road, a
   trail, a river or open country passes from one district into the next, fixed
   before either side is drawn. Cells may be negative: a plan grows on any side,
   and the map is laid out from its west and north edges again. Sizes, offsets
   and widths are even, so the tree lattice is never cut along a seam.
   `checkPlan` says what is wrong with a plan before anything is drawn.
2. **Each district** starts from `startDistrict(plan, id)`: all wood, its edge
   sealed two tiles deep and locked, cut open only at its openings, so whatever
   its program draws can only leave where the plan says. A way off the map is
   open at the rim on one tile only, with a bush beside it, so it is a pocket a
   raid steps into and the map's edge is sealed everywhere else, as on every
   shipped map. `districtFile` gives it a way out at every opening, so it can be
   played on its own in TRY IT.
3. **The stitcher** (`stitch.ts`) puts the districts drawn so far into one map
   file. A district not drawn yet is wood - the map is playable while it is
   incomplete, and the road simply runs into the forest at a way out that opens
   90 seconds in (`WAITING_EXIT_OPENS`), so no part of an unfinished map is a
   dead end - and every seam is reported as joined, broken or waiting. A
   district left open at its edge where no crossing is planned is a problem, as
   is anything over a map file's limits (256x256 tiles, 8 drop-ins, 12 ways out,
   40 item spots, 16 places, 32 links; a plan marked `builtIn` is the game's
   own map and is held to `BUILT_IN_MAP_FILE_LIMITS` instead, which also lets it
   be 384 square). A cell of the plan that is no district is wood too, unless
   the plan names it in `seas`: open sea, laid as deep water, so a coast that
   faces it meets the sea, and a way out (a boat, a stair to the water) may face
   it. A district marked `island` starts as open sea instead of wood and is laid
   as sea until it is drawn.

```sh
npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/examples/quarryRoad.ts out/quarry-road
```

writes the stitched map, the plan as one picture (`.plan.png`), the whole map,
each district with its moves washed in colour, and each cave floor, and prints
the seams, the hard checks on the whole map and each district's own report.
With no district drawn yet it prints and draws the plan alone. `--write=<path>`
also writes the stitched map file there, and only when the whole world passes
its hard checks - which is how a map drawn this way is shipped.
`examples/quarryRoad.ts` is the worked example: two districts drawn apart and a
two-floor cave under the quarry.

A plan can also say what the picture shows and the districts' programs have to
honour:

- each district's `terrain`;
- `hidden` crossings (a deer path nobody signs), and crossings that open only
  on a night raid;
- `landmarks` (a landmark, a landing, a secret, roughly where);
- `caves`: how many floors, how they are drawn (Mt. Moon, or a FireRed hideout,
  ice cave or tower), and the mouths in which districts, each onto which floor
  and whether the Card Key locks it;
- `sailings`: a boat between two jetties, its route a cell at a time across
  `seas` and the window it runs in;
- a far place's `reach`, which is the brief its drawing worker starts from: how
  a raid gets in, why that is hard, what is only there, and what the game still
  has to learn to build it.

`districtsOutOfReach` asks whether any district has no way in at all by road,
boat or cave. `worlds/` holds the real maps
being drawn this way: `worlds/greystoneVale/` is the first
(`docs/screens/greystone-vale/`), shipped as
`src/game/world/maps/greystoneVale.json` and held to its program by
`worlds/greystoneVale/greystoneVale.test.ts`.

## Caves

`caves.ts` draws floors the way the map research's best caves were drawn
(level with FireRed's Mt. Moon 1F in blind judging): rooms of different sizes
in an irregular rim, a spanning tree of winding passages plus extra ones for
loops, sand drifted into a few rooms, rows of boulders as low walls in the big
rooms. A floor can be **sealed** - split into halves joined only through other
floors - which is what makes a stack of floors a maze rather than a staircase.

`caveMaze` stacks floors, joins them with several ladders a pair (a hole above,
a ladder up below, on alternate halves of a sealed floor), cuts each mouth's way
out into its floor's south wall, keeps furniture clear of every way through, and
hides an item in every third dead-end room. `caveMouthSpots` finds the foot of a
rock face outdoors, where the game requires a cave mouth to be cut.

## Before and after

`docs/screens/mapcraft/`: the same district drawn by round 2's best method and
drawn with these tools, each with its moves washed in colour; and the example
world's plan, its stitched map, the same map with one district still to draw,
and its lower cave floor.
