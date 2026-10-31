# The Raid Arena, made more fun

What it does for somebody coming back to it. Made by `tools/playtest/arenaFun.mjs`, which plays each with the real keys on a test-mode build.

**The crowd knows you** (`src/game/base/arenaCrowd.ts`). On coming home: `crowd-roar` and `crowd-roar-paper` for a big haul, `crowd-groan` for a wipe, with some of them leaving and the fires low. `crowd-thin-house` and `crowd-full-house` are the same stands for a new game and a veteran. `crowd-wave` is the interact key at the far wall. `crowd-run-se` is the band of people getting up beside somebody running the outer floor, and `crowd-lap-done` a whole lap.

**Stick the landing** (`src/game/world/raidArrival.ts`). `landing-clean-ring` is the ring closing, with its hint for somebody who has never stuck one; `landing-second-landed` is a clean one with a run on.

**The pit remembers** (`src/game/world/raidMemory.ts`). `memory-named` is the rim saying what a mark was, with the last raid's walk leading to it.

**Feed the pit** (`src/game/base/pitCoins.ts`). `coin-over` is a coin going over, and `coin-gift-landed` what came back.

**Bouts for show** (`src/game/base/arenaBouts.ts`). `bout-offer` is the next hunter on the far floor, with the view come up to the wall and the crowd. `bout-fight` is the real battle screen, on copies. `bout-won` and `bout-lost` are coming back, and `bout-ladder-done` and `bout-banner` all five in a row and the player's banner on the wall.
