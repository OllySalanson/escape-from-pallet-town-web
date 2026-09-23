# Base stat audit - before and after

The Pokemon Center's detail pane with the cursor on each of the four species
whose stats changed, seeded at level 50 so a ten-point base change shows as
about five points of real stat. `before` is `main` as it was, `after` is every
stat pinned to FireRed (`docs/pokemon/stat-audit.md`).

    node tools/playtest/statShots.mjs http://localhost:<port>/ <out dir> --level=50

| Species | Stat | Before | After |
| --- | --- | --- | --- |
| Dugtrio | Attack | 55 | 45 |
| Pikachu | Defense | 25 | 20 |
| Pikachu | Sp. Def | 30 | 25 |
| Butterfree | Sp. Atk | 50 | 45 |
| Jigglypuff | Sp. Def | 15 | 17 |

(Real stats at level 50: `floor(base * level / 100) + 5`.)
