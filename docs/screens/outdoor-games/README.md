# The promenade's outdoor games: the derby, the dig and the fishing derby

Step H7 of the harbour arenas plan: THE PROMENADE DERBY over the race's start where THE GREEN meets the stone, THE DIG on the beach between the huts, and THE FISHING DERBY at the head of the pleasure pier - each under a board that says what it is (DERBY, DIG, FISH; `scripts/draw-promenade.mjs`), and each with regulars stood about watching it (`watch-game` in `base/harbourActivities.ts`). Played end to end by `tools/playtest/outdoorGames.mjs` against a test-mode build, once with Pokémon the games are for and once with ones they are not.

    node tools/playtest/outdoorGames.mjs <url> <out dir> --team=suited|unsuited

| | Suited | Unsuited |
| --- | --- | --- |
| THE PROMENADE DERBY (a wet day) | Ponyta, 2nd of 6 in 12.70s - 20 tickets | Golem, 6th of 6 - nothing |
| THE DIG | Diglett (a plus a dig, DIG, Sand Veil), 45 points - 30 tickets and three berries | Psyduck (a square a dig), 15 points - nothing |
| THE FISHING DERBY | Staryu (Illuminate: every cast bites), 276 points - 30 tickets | Grimer (Stench: a cast in four), 78 points - 10 tickets |

- `suited-*-01-board.png`: each board, faced - DERBY on its chequered start beside THE BATTLE ARENA, DIG on the sand with its spade, FISH at the pier head.
- `suited-*-02-who-plays.png`: the one picker every outdoor game shares - every box, best fits first, what each Pokémon would do well in a few words.
- `*-derby-03-racing.png`: the race on THE HARBOUR's own ground from above, the field's order down the side and the fork's choice at the foot.
- `*-dig-03-digging.png`: the roped patch, a ping and what came up.
- `*-fishing-derby-03-fishing.png`: a bite off the deep end, and the tally.
- `*-04-result.png`: what each paid.
