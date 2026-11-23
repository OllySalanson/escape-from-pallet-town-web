# A job walked out of the wrong exit

Both are the result screen after taking the SEALED DISPATCH job, picking the
dispatch case up at THE OLD LIGHT and walking out of the nearest exit,
SMUGGLERS' PATH, instead of DEER GAP. Taken at 960x600 in the machine's
headless Chromium on a test-mode build (`?testmode=1`, so the Canvas renderer),
driven by `tools/playtest/ai-player/act` from a save with a few raids behind it.

- `before.png`: main at 4fe41b69. The verdict is "YOU GOT OUT WITH A LITTLE",
  and that the job was lost - "You had it, and SMUGGLERS' PATH is not DEER GAP.
  It came home unpaid, and the board has moved on" - is the last row of the
  BANKED pane, under MORE.
- `after.png`: the summary opens with "Job unpaid: SMUGGLERS' PATH is not DEER
  GAP." (a different raid of the same job, so the haul differs).
