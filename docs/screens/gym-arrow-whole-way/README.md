# Once the first jobs are banked, the gold arrow leads to the next gym the whole way

The AI playtest's friends (22 Nov 2026) all banked Oak's first jobs by following the gold arrow,
then wandered the vale looking for the gym: the arrow only turned to the gym in the last 10 steps
(`docs/screens/gym-door-arrow/`). Now, once the first jobs are banked (`isFirstJobsBanked`, the
same test as the finish line's "Contract chain banked"), the arrow and the chip lead to the next
gym's door from anywhere it can be walked to. The briefing and Oak's radio still name the job.

- `jobs-not-banked.png`: a save with no standing job banked, landed on HIGH MOOR. The chip leads the job (`STAKE 1: SE (3 LEFT)`).
- `jobs-banked.png`: the same landing with two banked. The chip says `CERULEAN GYM: SE`, from the far side of the vale.

Both come from a test-mode build (`?testmode=pixels`, 1200x768), deployed by `tools/playtest/deploy.mjs`
with `--insertion=greystone-vale-moor-top` and `--banked=0` or `--banked=2`, on 22 Nov 2026.
