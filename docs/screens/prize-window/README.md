# THE PRIZE WINDOW grows

The harbour arenas plan's step H5: held berries, TM11 Sunny Day and TM18 Rain
Dance one a week each, the SMOKE BALL, the POKé FLUTE, DRATINI, PORYGON and
THE RUMOUR MILL (`src/game/minigames/tickets.ts`, `TICKET_PRIZES`).

Played by `node tools/playtest/prizeWindow.mjs <test-mode build url> <dir>` at
1200x768: a new game earns its tickets at the POKéMON JUMP cabinet, is then
handed the tickets a few weeks of the cabinets would have paid (they pay at
most 285 a day), buys at the window, and takes what it bought on a raid.

- `01-jump-paid.png` - the tickets earned at the cabinet, by the screen.
- `02-prize-window.png` - the window's shelves: held berries, for raids, POKéMON,
  the rumour mill, for the house.
- `03-rumour-mill.png` - a slip from THE RUMOUR MILL: when and what to bring,
  the two facts the angler's rumour of THE RED ONE leaves out.
- `04-dratini.png` - DRATINI bought, into a box.
- `05-raid-shelf.png`, `06-one-a-week.png` - TM18 bought, and a second refused
  until next week.
- `07-one-at-a-time.png` - the SMOKE BALL and the POKé FLUTE are sold again only
  once the one held is lost; DRATINI says YOURS.
- `08-dratini-in-a-box.png` - DRATINI on YOUR TEAM (P), at Lv 15: the level it
  first knows an attacking move (below it, only Leer).
- `09-flute-packed.png` - the flute on the rack.
- `10-catchy-tune.png` - played from the raid pack, in FireRed's own words.
- `11-wild-meets-a-smoke-ball.png`, `12-run-from-wild.png`,
  `13-fled-using-smoke-ball.png` - the lead holding the SMOKE BALL (named on its
  plate), RUN at 100% against a wild POKéMON met in tall grass, and FireRed's
  "fled using its SMOKE BALL!".

The SMOKE BALL is given to the lead by the driver writing the save, as the team
screen's gear slot would: giving gear is older than this change.
