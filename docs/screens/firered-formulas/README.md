# FireRed's stat and damage formulas - before and after

The Pokemon Center's detail pane (Bill's PC) with the cursor on each starter's
second stage at level 28, the level of the veteran's Ivysaur that showed the
playtest the old numbers. `before` is `main` with the Unity original's
`floor(base * level / 100) + 5`; `after` is FireRed's own formula with no IVs,
no EVs and a neutral nature, `floor(2 * base * level / 100) + 5` (HP
`+ level + 10`).

    node tools/playtest/statShots.mjs http://localhost:<port>/escape-from-pallet-town-web/ <out dir> --level=28 ivysaur charmeleon wartortle

each against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`, served
under its Pages subpath as `tools/playtest/README.md` says), `main` for before
and this branch for after.

| Lv 28 | HP | Attack | Defense | Sp. Atk | Sp. Def | Speed |
| --- | --- | --- | --- | --- | --- | --- |
| Ivysaur before | 54 | 22 | 22 | 27 | 27 | 21 |
| Ivysaur after | **71** | **39** | **40** | **49** | **49** | **38** |
| Charmeleon before | 54 | 22 | 21 | 27 | 23 | 27 |
| Charmeleon after | **70** | **40** | **37** | **49** | **41** | **49** |
| Wartortle before | 54 | 22 | 27 | 23 | 27 | 21 |
| Wartortle after | **71** | **40** | **49** | **41** | **49** | **37** |

`dojo-great-ball-after.png` is THE BATTLE ARENA's counter once BLACK BELT HIDEKI
is beaten on the real battle screen (`tools/playtest/dojoClasses.mjs`): MIKE now
fields a Machop, a Machoke and a Poliwrath, re-chosen because at FireRed's
scale his old team measured easier than his own class's regulars
(`arena/classes.ts`).
