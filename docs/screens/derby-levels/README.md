# THE PROMENADE DERBY's levels

Four courses, each opened by finishing the one before it in the top three (`minigames/derbyLevels.ts`). Played in order, end to end, by `tools/playtest/derbyLevels.mjs` against a test-mode build: Doduo on THE FRONT, Dugtrio on THE SANDS, Horsea on THE BREAKWATER, Doduo on THE GRAND DERBY.

    node tools/playtest/derbyLevels.mjs <url> <out dir> [--port=<cdp port>] [--window=1200x768]

| Level | Course | New on it | Field |
| --- | --- | --- | --- |
| 1 THE FRONT | the race as it shipped, frame for frame | - | 5 regulars |
| 2 THE SANDS | the front, home along the beach to a finish on the west sand | sand (full pace only for a Ground type), crates leapt at a sprint | 5, riding better |
| 3 THE BREAKWATER | the sands, then out along the breakwater and round its end | waves breaking over the stone, warned before they break; a Water type rides them | 6, riding better, Pokémon evolved once |
| 4 THE GRAND DERBY | a whole lap from the west sand: the green or the shore, crates down the front, the pier and the breakwater | four forks | 7, riding best, Pokémon fully evolved |

- `01-courses-first-visit.png`: the COURSE row over who races - only THE FRONT open, and the line under it saying what opens the next.
- `02-level-1-the-front.png`: THE FRONT, with LEVEL 1 OF 4 over the place in the side column.
- `03-level-2-open.png`: THE SANDS chosen after a podium on THE FRONT; Dugtrio is "At home on sand".
- `04-level-2-the-sands.png`: a crate on the pier, and the second fork (PIER or SANDS).
- `05-level-3-the-breakwater.png`: THE BREAKWATER's second fork, with the bay open to a swimmer.
- `06-level-3-wave-warning.png`, `07-level-4-the-grand-derby.png`, `08-level-4-wave-breaking.png`: a wave said (WAVE!, the sea washing up over the stone) and a wave broken over the stem of the breakwater, with eight in the field.
- `09-level-4-result.png`: every level open after the last race.
- `10-courses-smallest-stage.png`: the choosing screen at the smallest stage (320x240 at 3x).
