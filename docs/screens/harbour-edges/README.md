# THE HARBOUR's edges, after the 14 Nov 2026 playtest

The five findings of the harbour playtest of 14 Nov 2026, before and after. Every
"before" is the tester's own picture from `main` at `b0d13b41`; every "after" is
this branch.

| | Before | After |
|---|---|---|
| 1. The long pier's head was solid on its left third, drawn as open paving | `1-pier-head-before.png` | `1-pier-head-after.png`: walked from (27,19) straight down to (27,23), under the awning |
| 2. A rod cast into the rowing boats and the ships' hulls | `2-fishing-boat-before.png` | `2-fishing-boat-after.png`: facing the red boat at (38,21), no FISH on the hint line |
| 3. The rim's SAFE line ran off both edges on every first jump | `3-rim-safe-before.png` | `3-rim-safe-after-1200x768.png`, `3-rim-safe-after-960x720.png`: it goes on to a second line |
| 4. THE WAREHOUSES spoke on the boutique's step, over its name | `4-boutique-step-before.png` | `4-boutique-step-after.png`: the boutique alone |
| 5. On the smallest screen the lab's door was under the FEEDBACK tab | `5-arrival-960x720-before.png` | `5-arrival-960x720-after.png`, `5-arrival-640x480-after.png`: all four doors, the lab's clear |

How they were made: a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`)
served under `/escape-from-pallet-town-web/`, one headless Chromium, and

- `node tools/playtest/harbourEdges.mjs <url>?testmode=pixels <dir>` for 1, 2, 4 and 5
  (it fails if any of the four comes back), and once more on a plain build at
  real speed;
- `node tools/playtest/firstRaid.mjs <url>?testmode=pixels <dir> --shots --window=1200x768`
  (and `--window=960x720`) for 3, a brand new save from the title to its first raid.
