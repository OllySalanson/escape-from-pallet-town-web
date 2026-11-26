# The vale's locals

Taken on 26 Nov 2026 against test-mode builds at `PIXEL_WINDOW` (1200x768), one
browser per build. The before is `main` after #887 (THE MAP on M), played by
`tools/playtest/mapScreen.mjs`; the after is this branch, played by
`tools/playtest/localTale.mjs` (a new save's first raid, AUNTIE MAB in Mill
Square, her tale read to the end, then M and Z).

| | before | after |
|---|---|---|
| Mill Square | `before-mill-square.png`: no local | `after-mill-square.png`: AUNTIE MAB on the square, the harbour's "!" over her |
| the tale's last box | | `after-inks-in.png`: "AUNTIE MAB takes your map and inks in all of MILLBROOK." |
| M, close up | | `after-map-close.png`: Millbrook in colour round Sam, walked or not |
| M, the whole vale | `before-map.png`: fog but for the tiles walked | `after-map.png`: the whole square of MILLBROOK lit |

    node tools/playtest/localTale.mjs "http://localhost:$PORT/escape-from-pallet-town-web/" out [--local=NAME]
