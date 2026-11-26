# THE MAP on M

Taken on 25 Nov 2026 by `tools/playtest/mapScreen.mjs` against test-mode builds
(`VITE_EPTW_TEST_MODE=1 npx vite build`) at `PIXEL_WINDOW` (1200x768), one
browser per build: `main` at 22be845b for the before, this branch for the after.

The raid is a new save's first raid, a few steps east and south of the landing in
Mill Square. The harbour is the same save with a walked-ground record laid on it
(`npx vite-node tools/tileset/sampleSurvey.mts -- survey.json greystone-vale=6`,
the vale's entry only, passed as `--survey=`) and no steps kept beside it - a
player from before THE MAP - so its map shows the steps read back off that
survey (`world/trodden.ts`).

| | before | after |
|---|---|---|
| a raid | `before-raid.png`: the chip names O, L, B and P | `after-raid.png`: and `[M] MAP`, until it has been pressed once |
| M in a raid | `before-raid-m.png`: nothing (M was the sound) | `after-raid-map.png`: close round Sam, crisp, from the vale's own tiles: the seven tiles Sam has stood on in colour, fog everywhere else, Sam's square beating, the raid clock top right |
| three seconds later | | `after-raid-map-later.png`: the clock has run on (4:56 to 4:53) and Sam has not moved |
| Z | | `after-raid-map-whole.png`: the whole vale |
| M at home | `before-harbour-m.png`: nothing | `after-harbour-map.png`: the walk in colour through the fog |

    node tools/playtest/mapScreen.mjs "http://localhost:$PORT/escape-from-pallet-town-web/" out
    node tools/playtest/mapScreen.mjs "http://localhost:$PORT/escape-from-pallet-town-web/" out --before   # on a build from before
