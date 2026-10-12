# YOUR NAME? at THE BOLTHOLE's door

The first time anybody walks into THE BOLTHOLE, the house asks who lives there,
in FireRed's own words (`gText_YourName`), before they can walk about inside.
It is the house console's name and rule (`src/game/console/playerName.ts`):
capitals, numbers and `. ! ? ' -`, up to ten, through the word filter, kept on
the device. So the console never asks somebody the door has named, a player
who already named themselves at the console is never asked at all, and the
door's caption in the yard says whose house it is (*OLLY's house*).

| | |
|---|---|
| `your-name.png` | Just in through the door: the line, the count, BACK OUTSIDE and OK. ENTER on an empty line is refused over the help bar and the screen stays; ESC or BACK OUTSIDE is back out onto the step. |
| `your-name-typed.png` | A name typed. ENTER or OK keeps it, and the house says *Welcome home, OLLY!* |

Taken from a test-mode build at 1200x768 by
`node tools/playtest/bolthole.mjs <url> <dir>`, which also plays the refusal,
the way back outside, the welcome, the console's copy of the name and the
door's caption.
