# A raid with no job says the gold arrow leads to the next gym

Choosing NO JOB on the rim sends the gold arrow to the next gym (`WorldScene.gymDoorNear`), but the card said only "None this raid: nothing to fetch", and Oak's radio still opened on the nearest landmark (the VILLAGE PUMP, to the west) with the gym as its last line.

- `before-card.png`: the rim card on main, with LINE SURVEY chosen (NO JOB was a button; choosing it showed only "nothing to fetch").
- `after-card.png`: NO JOB chosen after the fix.
- `after-radio.png`: O on landing after the fix.

Made with `tools/playtest/ai-player/act` on a test-mode build (`?testmode=1`, so no tints), a save with one contract banked.
