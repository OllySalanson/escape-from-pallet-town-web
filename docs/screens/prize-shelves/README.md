# THE PRIZE WINDOW, things on shelves

Olly's pick of 26 Nov 2026, from the mini-game mock-ups: the prize window drawn
as the prize room itself. Every prize stands on a wooden shelf with a gold
ticket for its price, and the clerk's counter answers for the one under the
cursor: the prize on the counter, what is left of it, and the sum it comes to.

| | |
|---|---|
| `before.png` | `main` before this change: a list in three columns |
| `after-the-wall.png` | the wall at 1200x768, the cursor on the Sitrus Berry |
| `after-buy-dratini.png` | ENTER on DRATINI: the counter asks, the cursor on NOT NOW |
| `after-porygon-short.png` | PORYGON with too few tickets: a grey ticket and 1,240 SHORT |
| `after-640x480.png` | the smallest screen: the wall scrolls, the counter is one line |
| `after-1920x1080.png` | a wide screen: the shelves stand in the middle of the wall |

The save in every picture has 2,760 tickets, ABRA already had, a SMOKE BALL and
a Sitrus Berry at home, two berries and TM18 bought already, and 120 of the
day's 285 tickets won.

Made with `tools/playtest/prizeShelves.mjs` against a test-mode build
(`VITE_EPTW_TEST_MODE=1 npx vite build`, served under the Pages subpath):

    node tools/playtest/prizeShelves.mjs http://127.0.0.1:<port>/escape-from-pallet-town-web/?testmode=pixels <out dir> [--window=WxH]

`before.png` is the same script against a build of `main`.
