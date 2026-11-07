# THE TREASURE MAP

Four pieces of one torn sea chart, pinned on a board behind THE GREAT LIBRARY,
leading to a smugglers' chest in Greystone Vale (`src/game/treasure/`).

Photographed in this machine's own headless browser at the real 3x window,
against a test-mode build (`VITE_EPTW_TEST_MODE=pixels npx vite build --base=/`,
served by `vite preview`):

```bash
# The harbour half: bottle, MARLOW, THE CHART ROOM, every piece pinned.
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --save-out=whole.json
# The dig: a raid from the Cove Steps with the whole chart pinned and MISTY beaten.
node tools/playtest/raid.mjs <url> --attach=<cdp port> --stepped --pixels --window=pixel \
  --insertion=greystone-vale-cove-steps --beaten=vale-gym-misty --hunt=shore,moor,hollow,fold \
  --level=40 --grab=sea-chest --skip-contract --shot=dig.png --shot-dialogs --save-out=dug.json
# The ending: that raid's save, carried to MARLOW.
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --chest=dug.json
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
  board, a dashed slot for every piece.
- `06-marlow-decides.png` - the first piece pinned, MARLOW decides the chart is
  the player's to finish: they and their partner are mighty.
- `07-board-one-piece.png`, `09-board-two-pieces.png`,
  `10-board-three-pieces.png` - the board filling up, a piece at a time.
- `08-bookcase-open.png` - back in the library, the end bookcase stands open
  for good and MARLOW has gone through it.
- `11-whole-chart-to-the-cove.png` - the chart whole, its frame gilded, and
  MARLOW reading the dotted line to SMUGGLERS' COVE.
- `12-dug-up-in-the-cove.png` - a raid with the whole chart: the X, under the
  cliff past the boat shed, gives up the SEA CHEST.
- `13-carried-home.png` - carried out at risk and banked.
- `14-the-chest-opened.png` - MARLOW opens it: ₽600, a HAULER FRAME and five
  GREAT BALLs.
- `15-the-chest-on-show.png` - the empty chest stays on show before the board.
