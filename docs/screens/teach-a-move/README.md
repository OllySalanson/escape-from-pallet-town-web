# Teaching a move

Reading a TM or an HM in the raid's own pack, and the move chooser a full
moveset opens (the captain, 2026-09-27: "when you apply moves to Pokemon it's a
bit unclear", and resting the mouse on a Pokemon changed which one was
selected).

Shot from real play with `node tools/playtest/teachShots.mjs <url> <dir>
--hover-check --window=1920x950` (and `--window=640x480`, the smallest stage),
`?testmode=pixels`: a Charmander, a Squirtle, a Lapras and a Seel reading TM13
Ice Beam, which is every answer a disc can get - cannot learn it, a free slot,
already knows it, four moves known. `--hover-check` fails the run if resting the
pointer on a card or a move moves the cursor.

## Before

| | what was wrong |
|---|---|
| `before-who-can-read-it-1920x950.png` | four one-line rows and a tag each, then a screen of empty backdrop; nothing said what Ice Beam does, what each Pokemon knew, whether anything would be forgotten or whether the disc would be gone. Pressing a row read the disc there and then |
| `before-pointer-moved-the-cursor-1920x950.png` | the cursor was on Charmander; the pointer resting on Seel moved it there, so the row about to receive the disc was wherever the mouse had last crossed |
| `before-move-chooser-1920x950.png` | four lines of numbers, no description of the moves being given up, and the first press on a move forgot it |

## After

| | what it shows |
|---|---|
| `after-2-who-learns-it-*.png` | the disc and the move it teaches across the top (type, category, power, what becomes of the disc); every party member as a card with its portrait, its four moves or free slots, and one sentence of what the disc would do to it. Refused cards are flat and dimmed but still explain themselves on the help bar. TEACH is dim until someone is chosen |
| `after-3-pointer-resting-1920x950.png` | the pointer resting on Seel draws a one-pixel rule round the card and reads its line on the help bar; the cursor (the lit card and its triangle) stays on Squirtle |
| `after-4-chosen-*.png` | Seel chosen: the card is marked CHOSEN, the cursor moves to the bar, and the bar says who, what, and that the TM is used up. Cancel un-chooses |
| `after-5-move-chooser-*.png` | Seel wants Ice Beam: the new move beside its portrait, and the four it knows as cards across the width, each with its own description |
| `after-6-forget-marked-*.png` | Headbutt marked FORGET; the bar asks "Forget HEADBUTT and learn ICE BEAM?" and only its button forgets. ESC un-marks |
| `after-level-up-chooser-1920x950.png` | the same chooser from a level-up at base, where DECIDE LATER is on offer |
