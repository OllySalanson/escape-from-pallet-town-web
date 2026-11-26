# THE PROMENADE runs round a bay

The captain, 25 Nov 2026: "The leisure end of town, or the harbour, with the beach and all the games and the battle arena etc. seems really underdesigned. Make it utterly perfect ... more spread out and beautiful, and more like a human would make it. Make it make sense."

## Before

`before-east-1x.png` (x 60-89 of the old 90-wide harbour), `before-promenade.png`, `before-beach.png`, `before-pier-head.png`. It was six straight stripes: wood, a lawn with every building pushed against the trees, stone, boards, sand, sea. Every door opened straight onto the walk. The Battle Arena was wedged between the DERBY board and a hedge. The Game Corner, prize window, course gate and time board were shoulder to shoulder in the north-east corner. Six huts stood in pairs at fixed spacing along the busy beach. The pier was a plank T that lined up with nothing, and the east end stopped in a wall of trees.

## How it was designed

Three block sketches (`concept-a.png` one front with a square on the arcade's line and a headland, `concept-b.png` two terraces, `concept-c.png` the arcade on the pier). A fresh critic who had not drawn them picked A and bent it into a bay of four places. It was built in the real art, judged by a second fresh critic, reworked (a broken rocky shore and a lookout where the walk ends, the course ground made readable, the huts shuffled and split, fewer stray rocks, a PIER arch over the gate, the square in the walk's own stone, a varied tree line), then judged in the game by a third, reworked again (one row of lamps, the walk's stone to the lookout, a fisherman in sight of the walk), and by a fourth, which asked for the boardwalk to go and the pier's stop to stand over water.

## After

The harbour is 130 wide; nothing west of x 61 moved. `after-east.png` is the whole new end (x 60-129). The rest are the real game at the 3x window, by day, everything built (`after-*.png`):

- **The sport end** (`after-arrive-from-green.png`, `after-arena-forecourt.png`). The DERBY's gantry stands over a chequered start line painted across the walk. THE BATTLE ARENA is set back on a forecourt with its colours either side of the door.
- **PIER SQUARE** (`after-pier-square.png`, `after-pier-gate.png`). THE GAME CORNER and its prize window are across the head of the square. The pleasure pier leaves from its foot under a drawn PIER arch, on the arcade door's own line, so the view out of the arcade runs down the pier to the FISHING DERBY's board. The ice cream stands at the gate.
- **The pleasure pier** (`after-pier-middle.png`, `after-pier-head.png`). Half way out, over the water, there's a stop with a bench and a fisherman. At the head are the FISHING DERBY, lamps, pennants, a lifebuoy and the catch.
- **THE GARDENS** (`after-gardens.png`, `after-huts.png`). A drawn bandstand stands up a gravel path with flower beds and benches. The beach huts are a terrace of four and a pair, with steps down between them.
- **THE POINT** (`after-lookout.png`, `after-course.png`). The walk ends on a paved lookout with a coin telescope over a rocky shore. THE FIELD-MOVE COURSE's gate is up a path beside its fenced ground of scrub, rocks and a pool. The bottle washes up by the rocks below.
- **The beach** (`after-beach.png`) is a bay, widest under the sport end, with THE DIG, parasols, sandcastles and boats pulled up.

Benches and lamps stand on the walk's seaward row, turned to the sea, against one railing with the sand below it, open only at the steps down; a pair walks its two landward rows end to end. The old boardwalk, a second walk beside the first that nothing stood on, is gone.

## How they were made

`npx vite-node tools/base/renderBase.mts -- out.png 1 --built=all` for the whole map, cropped to x 60-129. The game pictures came from `node tools/playtest/harbourTour.mjs <test-mode build url>?testmode=pixels <dir> --built=all --clock=day --at=name:x:y,...` against a test-mode build (`tools/playtest/README.md`, "Memory"). `node tools/playtest/walkableVillage.mjs <url>?testmode=1 <dir> --area=harbour` walks every route there and back: 0 snags over 50 walks.
