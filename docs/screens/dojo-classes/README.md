# THE BATTLE ARENA's classes

The harbour arenas plan's H2b (`src/game/arena/classes.ts`): four classes, FireRed's dojo four at their heads, tickets for wins, the class board, and the class ball on a name plate. Played by `tools/playtest/dojoClasses.mjs` (the climb from POKé BALL to GREAT BALL) and `tools/playtest/sharedHarbour.mjs` (the ball on another player's plate), on a test-mode build.

| Picture | What it shows |
| --- | --- |
| `00-hideki-under-the-class-board.png` | A player in POKé BALL class with a run of three walks in: BLACK BELT HIDEKI stands under the class board, whose first ball is framed and three run squares lit. |
| `01-the-class-board.png` | The board, faced: the class and the run in words. |
| `02-hideki-will-see-you.png` | The counter: the head of the class first, READY after three in a row, then today's regulars at the class's stage. |
| `03-great-ball-class.png` | Back from beating him: GREAT BALL class, 100 tickets for the step and 10 for the win; the board's second ball lit. |
| `04-mike-under-the-board.png` | In again: MIKE now heads the class. |
| `05-great-ball-counter.png` | GREAT BALL's regulars bring their second stages; MIKE waits for a run of three. |
| `06-a-great-ball-on-a-name-plate.png` | Another player sees OLLY with a Great Ball on his name plate. |

The ladder is measured, not argued (`tools/arena/ladder.mts`, held by `arenaLadder.test.ts`): against the reference teams the regulars of POKé BALL class are won about 89% of the time, HIDEKI 68%, GREAT BALL's regulars 62%, MIKE 53%, ULTRA BALL's 45%, HITOSHI 29% and AARON 20%.
