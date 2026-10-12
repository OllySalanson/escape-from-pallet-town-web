# Names, one each

A player's name is chosen when a game starts, and nobody else in Pallet Town
can have it, whatever its case: ASH and Ash are one name. It is checked as it
is typed and claimed in the same step as it is checked, so two people pressing
OK on the same name at once cannot both have it (`src/game/names/`,
`supabase/migrations/*_unique_names.sql`).

| | |
|---|---|
| `name-taken.png` | NEW GAME asks YOUR NAME? before anything else. "ash" becomes ASH as it is typed, and the line under it says it is taken; OK says *Somebody already has that name. Pick another.* BACK goes back to the title, LATER plays without a name for now. |
| `name-free.png` | MISTY is free. OK claims it, and the starter screen follows. |
| `name-continue.png` | CONTINUE, for a player with no name yet: asked once, and LATER (or ESC) goes in without one. |
| `map-name.png` | MAKE A MAP: a new map is called something in the world's own words, with REROLL beside the field and the field free to type over. |

Twenty names the generator drew (`src/game/maker/mapNames.ts`, 6,498 possible,
every one of them through the word filter and the map-name rules):

KOFFING FORD · FERRYMAN'S STAIR · TINKER'S MOOR · THORNY CROSSING · MEOWTH BURN ·
ROTTEN MOOR · FOGGY ADIT · RANGER'S LEAP · THE HUNGRY WITHY BEDS · BITTER STRAND ·
WILD COPPICE · POLIWAG CUT · SMUGGLER'S RUN · QUIET HANGER · COLLIER'S TOWPATH ·
THE DROWNED TARN · SALTER'S LEAP · DUSK ROOKERY · THE BURNT KILNS · SHELLDER QUARRY

Taken by `node tools/playtest/names.mjs <url> <dir>` against a test-mode build
over the local stand-in, with ASH somebody else's.
