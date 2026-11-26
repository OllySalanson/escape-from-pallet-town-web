# Lines FireRed never says, taken out

Churchyard critic, round 2 (26 Nov 2026), under Olly's rule that a fight says only what FireRed's would:

- BLAZE (and Torrent, Overgrow, Swarm, Guts, a charged Flash Fire, Thick Fat, Shell Armor and Battle Armor) changed a hit and said so: "Your CHARMANDER's BLAZE is driving it harder!". FireRed says nothing.
- Every medicine's line in the ITEM list ended "Using it costs your turn.", a lesson on every item. It is the item's own description now, as FireRed's bag shows it.

The same fight on each build: a wild Gastly against a Charmander on 10 HP (a third of its HP, where BLAZE is on), ITEM opened and closed, then EMBER.

| | before | after |
|---|---|---|
| the ITEM list | `before/3-items.png`: "Restores 20 HP. Using it costs your turn." | `after/3-items.png`: "Restores 20 HP." |
| after EMBER's line | `before/7-line.png`: "Your CHARMANDER's BLAZE is driving it harder!" | none: `after/6-line.png` is EMBER's line, and the next is the turn's end |

The "Hurt? ITEM drinks a POTION." line both builds say is the first raid's own teaching (a brand new save); `before/9-line.png` is the low-HP line #987 took out.

Made with `node tools/playtest/battleLines.mjs <url> <dir> --hp=10 --move=EMBER --items` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
