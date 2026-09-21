# TMs and HMs

A machine is a disc that teaches one move to a Pokemon FireRed/LeafGreen says
can learn it (`src/game/pokemon/machines.ts`, checked against the committed
PokeAPI snapshot at `tools/moves/frlg-machines.json`). Five TMs are rolled field
loot at one raid in four, one per map and two on the vast one; the HM is a
once-per-save Bill barter, paid in materials and never in scrip.

Shot at 3x (1200x768) from real play, `?testmode=pixels`, real key events and
real clicks - `--seed=31` on Viridian Forest for the find, and a save with three
Pokemon and two discs banked for the refusal and the chooser. The two screens
that are new markup are shot at the smallest stage as well (640x480, 2x of
320x240); the battle and Bill's board are unchanged by this work.

| | what it shows |
|---|---|
| `found-in-the-field-1200x768.png` | TM09 on the ground in the forest, drawn as its own disc in the type colour of the move it teaches |
| `read-in-the-bag-1200x768.png` | the disc in the raid's own pack, one square, READ TO A POKÉMON |
| `who-can-read-it-*.png` | the party list while a target is chosen: it says who can read the disc *before* the player commits |
| `refused-1200x768.png` | a Squirtle refusing TM40, with the disc still carried - a refusal spends nothing |
| `move-chooser-*.png` | four moves already known, so the disc opens the chooser from PR #118 unchanged, with no "decide later" on offer |
| `bullet-seed-1200x768.png`, `hit-three-times-1200x768.png` | the taught move in a real fight, doing what its description says |
| `bill-barter-1200x768.png` | HM06 on the barter table: goods in, no scrip, once |
