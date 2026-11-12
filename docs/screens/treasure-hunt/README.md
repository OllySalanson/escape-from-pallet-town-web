# THE TREASURE MAP

Four pieces of one torn sea chart, pinned on a board behind THE GREAT LIBRARY,
leading to a smugglers' chest in Greystone Vale (`src/game/treasure/`). The
chart is the real SMUGGLERS' COVE, drawn off the vale's own map file
(`chartWall.ts`), so what is on the board is what a raid walks into.

Photographed in this machine's own headless browser at the real 3x window,
against a test-mode build (`VITE_EPTW_TEST_MODE=pixels npx vite build --base=/`,
served by `vite preview`):

```bash
# The harbour half: bottle, MARLOW, THE CHART ROOM, every piece pinned, the
# goal said at the board and by MARLOW, and the X on the Arena's telescope.
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --save-out=whole.json
# The dig: a raid from the Cove Steps with the whole chart pinned and MISTY beaten.
node tools/playtest/raid.mjs <url> --attach=<cdp port> --fresh --stepped --pixels --window=pixel \
  --insertion=greystone-vale-cove-steps --beaten=vale-gym-misty --hunt=shore,moor,hollow,fold \
  --level=40 --steps=radio,walk:91:302,shot:x-on-the-sand --grab=sea-chest --skip-contract \
  --shot=dig.png --shot-dialogs --save-out=dug.json
# The ending: that raid's save, carried to MARLOW.
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --chest=dug.json
# The explorer run: the kit's pieces pinned, and where that leaves the hunt.
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --playtest
```

The vale's three torn charts are put in the vault by the first driver as three
raids would have banked them; finding one in a raid is #482's
(`raid.mjs --clock=dusk --grab=chart-piece-1`).

- `01-bottle-on-the-beach.png` - the bottle at the tide line in the far corner of
  THE BEACH, past the pleasure pier, by the rocks.
- `02-bottle-found.png` - picked up: the BOTTLED CHART goes into YOUR THINGS.
- `03-marlow-in-the-library.png` - MARLOW, the old keeper of charts, by the
  library's end bookcase.
- `04-marlow-sees-the-chart.png` - shown the chart, he wants a closer look.
- `05-the-chart-room.png` - through the bookcase: THE CHART ROOM and its empty
  board, each missing piece chalked out in its own torn shape.
- `06-marlow-decides.png` - the first piece pinned, MARLOW decides the chart is
  the player's to finish: they and their partner are mighty.
- `07-board-one-piece.png`, `09-board-two-pieces.png`,
  `10-board-three-pieces.png` - the board filling up, a piece at a time: open
  sea and a ship, the cliff top and the steps the red line starts down, the long
  jetty and the cove's name.
- `08-bookcase-open.png` - back in the library, the end bookcase stands open
  for good and MARLOW has gone through it.
- `11-whole-chart-to-the-cove.png` - the chart whole, its frame gilded, and
  MARLOW saying where the X is.
- `16-the-x-on-the-telescope.png` - where a raid is planned: the chart's X on
  THE RAID ARENA's telescope, over the very tile, with the goal on its card (and
  MISTY, while she still holds the coast).
- `17-oak-on-the-radio.png`, `18-the-field-guide.png` - in the raid: Oak's first
  line is the X, which way and how far, and it is the field guide's first note.
- `19-the-x-on-the-sand.png` - the cove itself, as the chart drew it: the jetty,
  the boat shed, the sand spit, and the X on the sand under the cliff.
- `12-dug-up-in-the-cove.png` - the X gives up the SEA CHEST.
- `13-carried-home.png` - carried out at risk and banked.
- `14-the-chest-opened.png` - MARLOW opens it: ₽600, a HAULER FRAME and five
  GREAT BALLs.
- `20-the-rare-find.png` - and an old POKé BALL packed in the straw: a shiny
  EEVEE, handed over.
- `15-the-chest-on-show.png` - the empty chest stays on show before the board.
- `21-explorer-run-says-so.png` - the explorer run's kit holds one of each piece
  and no chest, and the board says so before the first goes up.
