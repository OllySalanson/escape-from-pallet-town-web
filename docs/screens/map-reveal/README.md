# A place coming up on THE MAP

Taken on 26 Nov 2026 by `tools/playtest/localTale.mjs` against a test-mode build
at `PIXEL_WINDOW` (1200x768): a new save's first raid, AUNTIE MAB's tale read to
the end in Mill Square. The before is the same moment on `main` after #900: the
last box is read and the raid simply goes on.

| | |
|---|---|
| `before-last-box.png` | the tale's last box; on `main`, read and the raid goes on |
| `after-last-box.png` | the same box on this branch |
| `after-1-flash.png` | the map comes up framed on MILLBROOK as it was, and the square flashes gold (0.9 s in) |
| `after-2-rising.png` | the colour comes up from the middle out (1.9 s) |
| `after-3-name.png` | the name goes up with a burst of stars and the jingle (2.9 s); the map goes by itself at about 4 s |

    node tools/playtest/localTale.mjs "http://localhost:$PORT/escape-from-pallet-town-web/" out
