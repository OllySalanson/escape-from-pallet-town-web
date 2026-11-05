# THE PROMENADE, THE GAME CORNER and POKéMON JUMP

Step H1 of the harbour arenas plan: THE HARBOUR grows east past THE GREEN into a
seaside front, with THE GAME CORNER on it, FireRed's own POKéMON JUMP in a
cabinet inside, TICKETS kept at home and a PRIZE WINDOW to spend them at.

Every picture here is the game itself, played by `tools/playtest/gameCorner.mjs`
against a `?testmode=pixels` page at the real 3x window, from a new save with a
Charmander, a Rattata, a Mankey, a Growlithe and a Bulbasaur:

    node tools/playtest/gameCorner.mjs 'http://localhost:5173/?testmode=pixels' docs/screens/promenade

The two `00-` pictures from above are `tools/base/renderBase.mts` (`--built=all`),
and `00-promenade-sheet.png` is `public/assets/promenade.png` at 3x.

| Picture | What it shows |
| --- | --- |
| `00-the-whole-harbour.png` | The harbour at 90 wide: everything west of THE GREEN where it was. |
| `00-the-promenade-from-above.png` | The garden where THE BATTLE ARENA will stand, THE GAME CORNER under its marquee, the stone walk, the boardwalk with its lamps and railings, the beach huts, parasols and deckchairs, and the pleasure pier. |
| `00-promenade-sheet.png` | What `scripts/draw-promenade.mjs` draws: the Game Corner's front and the seaside things. |
| `01-spawn.png` to `05-pier-head.png` | Walking it: off THE GREEN, along the front, down the pier. |
| `06-who-jumps.png` | The cabinet: who can jump (FireRed's list) and how. |
| `07-countdown.png` to `09-ouch.png` | A game: the count, the vine, and the end of it. |
| `10-result.png` | What the game paid: tickets and a berry, once a day. |
| `11-arcade.png` | THE GAME CORNER's hall: the attendant, the POKéMON JUMP cabinet, the old slots. |
| `12-prize-window.png` to `14-prize-room.png` | The prize window: a berry bought with tickets. |
