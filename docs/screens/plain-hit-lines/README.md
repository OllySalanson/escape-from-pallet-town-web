# A hit says "X used MOVE!" and nothing more

Churchyard critic, round 3 (26 Nov 2026), and Olly's rule that the game says things its own way: every hit's line carried arithmetic, "Your CHARMANDER used EMBER! -13 HP · SAME-TYPE x1.5". FireRed's line is "CHARMANDER used EMBER!" and the HP bar says what it took. The first raid's teaching fight also stopped saying "Every hit reports the HP it cost you.", which is no longer true.

The same fight on each build: a wild Gastly against a Charmander on 25 HP, then EMBER.

| | before | after |
|---|---|---|
| Gastly's hit | `before/3-line.png`: "Wild GASTLY used LICK! -6 HP · SAME-TYPE x1.5" | `after/3-line.png`: "Wild GASTLY used LICK!" |
| Charmander's hit | `before/4-line.png`: "Your CHARMANDER used EMBER! -13 HP · SAME-TYPE x1.5" | `after/4-line.png`: "Your CHARMANDER used EMBER!" |

The move list's own summary ("FIRE · POWER 40 · PP 25/25 · SAME-TYPE x1.5") is unchanged: it is the menu, not a line of the fight.

Made with `node tools/playtest/battleLines.mjs <url> <dir> --hp=25 --move=EMBER` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
