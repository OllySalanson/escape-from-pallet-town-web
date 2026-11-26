# THE GAME CORNER and its PRIZE WINDOW, after the critic tour

The harbour critic tour of 26 Nov 2026 scored THE GAME CORNER 3/10: "A
good-looking arcade where Jo can play nothing: Ivysaur cannot jump, and nobody
owns a Doduo." It scored the PRIZE WINDOW 5/10: "You cannot read what a prize
does until you can afford it."

`before/` is the critic's own pictures, on `main` at `4391c17e`. `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build,
on the critic's mid-game save (IVYSAUR and DIGLETT, 0 tickets). Test mode draws
with the cheap renderer.

| What | Before | After |
|---|---|---|
| The house lends a PIKACHU to jump, chosen by default when nobody of yours can, and it plays | `before/1-jump-nobody-can.png` | `after/1-jump-house-pikachu.png`, `after/1-jump-played.png` |
| The house lends a DODUO to pick | `before/2-berry-nobody-can.png` | `after/2-berry-house-doduo.png` |
| The attendant says it in two sentences and offers the loan | `before/3-attendant.png` (six boxes) | `after/3-attendant.png` |
| A prize's help says what it is with no tickets in hand | `before/4-prize-help-only-shortfall.png` | `after/4-prize-help-says-what.png` |
| The clerk says hello before her rumour, and names where tickets come from | `before/5-clerk-rumour-first.png` | `after/5-clerk-welcome-first.png` |
| YOURS is stamped in gold, not the red kept for what can be lost | `before/6-yours-red.png` | (CSS; no save here owns a prize) |
