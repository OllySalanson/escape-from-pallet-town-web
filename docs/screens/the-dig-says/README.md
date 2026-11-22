# THE DIG says SPACE, and says when a square is dug already

From the 22 Nov AI playtests:

- Players walked round THE DIG's sign on THE BEACH pressing SPACE everywhere except at it. The reason: while they faced the sign, the hint line said only `[ARROWS] WALK`. Now facing any harbour landmark, or the FIELD-MOVE COURSE's gate, says `[SPACE] <ITS NAME>` (`landmarkHint`).
- Once in the dig, SPACE on a square already dug only buzzed. A Ground type turns over five squares at a time, so one player took the dig for stuck with four digs left. Now the ping line says DUG ALREADY!

`hint-before.png` (`main`) and `hint-after.png` show a new save at 67,19 facing the sign. `dug-already.png` shows the same square dug twice. All were taken on a dev server at `?testmode=1`, 1200x768, with a scratch driver that walks the base's own collision (as `deploy.mjs` does).
