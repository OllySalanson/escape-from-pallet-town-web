# FireRed's own words: stat names, the level-up, and a status on the POKéMON list

Churchyard critic, round 3 (26 Nov 2026):

- Stats were written "Attack", "Defense", "Sp. Attack". FireRed's `gStatNamesTable` writes ATTACK, DEFENSE, SP. ATK, SP. DEF and SPEED, with accuracy and evasiveness in small letters.
- A level-up said "grew to Lv 14!". FireRed's `sText_PkmnGrewToLv` says "grew to LV. 14!".
- The POKéMON list in a fight showed no status, so a burned Gastly on 3 HP was sent in and fainted to its burn. A status now stands where the level does, as on FireRed's party screen.

The same fight on each build: a wild Gastly against a burned Charmander on 25 HP, POKéMON opened and closed, then GROWL.

| | before | after |
|---|---|---|
| the POKéMON list | `before/3-party.png`: "CHARMANDER 25/31" | `after/3-party.png`: "CHARMANDER BRN 25/31" |
| after GROWL | `before/7-line.png`: "Wild GASTLY's Attack fell!" | `after/7-line.png`: "Wild GASTLY's ATTACK fell!" |

Made with `node tools/playtest/battleLines.mjs <url> <dir> --hp=25 --status=burn --move=GROWL --party` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
