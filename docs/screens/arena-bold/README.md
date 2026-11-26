# THE BATTLE ARENA in Champion Red

Olly's pick of 26 Nov 2026, from the mini-game mock-ups: the arena's cup of the
week and daily rentals in the boutique's Big and Bold look, Champion Red. A red
sunburst, ink, white and gold, slanted cards and stickers, the thing under the
cursor drawn big. The three ways to fight are tabs across the top (Q and E step
between them). The counter's first page and the class bouts keep the side panel.

| | |
|---|---|
| `before-the-cup.png` | `main`: the cup was a list in the side panel |
| `before-rentals.png` | `main`: the rentals were a list too |
| `after-the-cup.png` | the cup's page with nobody chosen: FIGHT waits, the cursor on YOUR THREE |
| `after-who-goes.png` | YOUR THREE opens the list of who goes, as before |
| `after-the-cup-with-three.png` | three chosen, the rule kept, two bouts won and KARPKING next |
| `after-rentals.png` | today's six, the pair taken, the cursor on CUBONE |
| `after-the-swap.png` | a run two wins in: PONYTA from the team just beaten, waiting for who goes back |
| `after-cup-640x480.png`, `after-rentals-640x480.png` | the smallest screen: the pictures given up, the page scrolls |
| `after-cup-1920x1080.png` | a wide screen |

Every regular is drawn in the look they wear about the harbour.

Made with `tools/playtest/arenaBold.mjs` against a test-mode build
(`VITE_EPTW_TEST_MODE=1 npx vite build`, served under the Pages subpath); the
`before` pictures are the same script against a build of `main`:

    node tools/playtest/arenaBold.mjs http://127.0.0.1:<port>/escape-from-pallet-town-web/ <out dir> [--window=WxH]
