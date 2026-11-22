# The rim says why nobody can go

The captain, 22 Nov 2026: "I've just gone into my first raid and I died immediately and now I'm just back in the raid arena. I'm trying to re-enter but it won't let me re-enter and it should be clear why."

Both pictures are the same moment on a dev server at `?testmode=1`, 1200x768: a new save takes Charmander, jumps in at Mill Square, loses its first fight (the driver set it to 1 HP and walked it into the hunter), presses through the result, and walks up to the rim again.

- `before.png` - `main` at b6f99202. JUMP IN is greyed out under a heading that still reads JUMP IN AT MILL SQUARE, and the only word on why is the grey small print at the foot of the card.
- `after.png` - the card's heading says NOBODY CAN JUMP YET in red, and the reason ("Everyone you have has fainted. Nurse Joy can revive them, out of the door and across the yard.") is the first line, in red, above the stakes.

The driver was a scratch script on `tools/playtest/deploy.mjs` (`walkIntoBase`, `jumpIn`, `openHallPanel`), not committed.
