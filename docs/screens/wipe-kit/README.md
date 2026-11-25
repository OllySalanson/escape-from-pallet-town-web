# The wipe kit (critic's problem 11)

A save holding 1 Potion, 1 Poké Ball and ₽110 deployed with both, then reloaded the page mid-raid (an abandoned raid settles exactly as a wipe does). The last line of the base's box says what Oak's kit put back.

- `before-kit-line.png` - main at 4695126d: "Waiting at base: 2 Potions, 5 Poké Balls and 1 Satchel." The vault went from 1 and 1 to 3 and 5: losing paid more than the raid's ₽110 would buy at Bill's.
- `after-kit-line.png` - this change: "Waiting at base: 2 Poké Balls and 1 Satchel." The Potion the locker kept is the kit's one Potion, so none is added.

Made with a scratch driver over the `tools/playtest/deploy.mjs` helpers (new game, edit the save, `walkIntoBase('raid-arena')`, `jumpIn`, `Page.reload`, CONTINUE), `?testmode=pixels`, 1200x768.
