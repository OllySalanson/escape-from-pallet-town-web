# FLEE when it ends the raid

`after.png`: a hunter fight (LORELEI) with 0:20 left on the raid clock, at
960x600 in the machine's headless Chromium on a test-mode build
(`?testmode=1`). The clock was moved to 0:20 in the fight through the test
handle (`scene.getScene('battle').runSession.manager.tick(...)`), because a
hunter does not come on cue. Before this change the same command read
`FLEE: CLOCK OUT`; choosing it said "You broke away from LORELEI! ... LORELEI
lost your trail and holds off for 20s. Breaking contact cost 40s of raid
time." and the raid ended at once with "The clock ran out with you still
inside."
