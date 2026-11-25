# A wild fight with a shiny in it went black first

On a raid a level-6 Caterpie jumped out of the grass and the screen stayed black for about five seconds before the fight came up (the captain, 25 Nov 2026, on the live game). A shiny's colours are not loaded at boot, and `BattleScene.preload` fetched them for any fight that fielded one - a shiny in the party, or a shiny foe - and Phaser holds a scene's first frame until its loader is done, with the world already faded out. On a slow line that is seconds of nothing. A fight with no shiny in it waits on no download and drew in about 0.2s, then and now.

Now the world fetches the party's shiny battle sprites in the background when the raid starts, and a wild shiny's as it is rolled, and the battle never waits: it draws at once and swaps the shiny colours in when they arrive (`pokemon/shinyTextureFetch.ts`).

Measured on a line with 1.5s of latency and the cache off, a new save in Greystone Vale, from the encounter to the battle's first frame:

| fight | before (live, 3be9178f) | after |
|---|---|---|
| a shiny Pidgey in the party | 1.96s black | 0.30s |
| a shiny Caterpie | 1.95s black | 0.32s |
| no shiny anywhere | 0.32s | 0.30s |

- `before.png` - the shiny Caterpie's fight 0.7s after the encounter, on the live game: black.
- `after.png` - the same moment with the fix: the fight is up, the Caterpie in its ordinary colours while its own are on their way.
- `after-6s.png` - six seconds on: the shiny colours have arrived and it is drawn in them.

Made by `tools/playtest/battleGap.mjs <build url> --latency=1500 --wild-shiny --shot=<file>.png` (`--team=pidgey:8::shiny` for the party's shiny), at 1200x768, against the live game for before and a build of this branch for after.
