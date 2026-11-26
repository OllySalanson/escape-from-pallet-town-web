# A fight says only what FireRed's would

Olly, 26 Nov 2026: "We don't want these AI reminder things everywhere that explain how to do things." Four lines that taught were taken out of every fight: the low-HP line naming a Potion, the type-chart line after an effectiveness line, the catch tip after a healthy Pokémon breaks free, and a standing Pokémon's "It isn't looking for a fight..." (it now only cries).

The same fight on each build: a wild Gastly against a Charmander on 7 HP with Potions packed, then SCRATCH, a NORMAL move a GHOST cannot be hit by.

| line | before (`main`) | after |
|---|---|---|
| after "Wild GASTLY appeared!" | `before/2-line.png`: "CHARMANDER is low on HP! Choose ITEM to give it a POTION." | none |
| the commands | `before/3-commands.png`: on ITEM, so the first OK opened the bag | `after/2-commands.png`: on FIGHT |
| after "It doesn't affect Wild GASTLY..." | `before/7-line.png`: "NORMAL can't touch GHOST." | none: `after/5-line.png` is the last line about the move |

"Hurt? ITEM drinks a POTION. It costs your turn." is the first raid's own teaching, said because this is a brand new save; it is not said in a fight after the first contract.

Made with `node tools/playtest/battleLines.mjs <url> <dir>` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
