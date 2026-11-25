# The raid arrow: first raid only, then the last thirty seconds

Made on a test-mode dev page (`?testmode=pixels`, 1280x800) with `tools/playtest/deploy.mjs`, the loop paused and stepped; the later raid's save had `recover-lost-field-kit` banked, and the clock was moved on with `runSession.manager.tick()` and then stepped 50ms at a time across 0:30.

1. `1-first-raid.png` - a new save's first raid: the gold arrow is on the PIDGEY, as before.
2. `2-later-raid-early.png` - a later raid at 4:59: no arrow; the chip names the job.
3. `3-later-raid-0-30-pop.png` - the same raid on the frame the clock reaches 0:30: the green arrow lands at four times its size, pointing at WESTWARD ROAD, the nearest way out.
4. `4-later-raid-settled.png` - a moment later, settled at its own size.
