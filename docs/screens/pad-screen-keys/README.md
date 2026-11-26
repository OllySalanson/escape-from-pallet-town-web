# A screen's own keys are on the touch pad again

Since every screen's keys moved to a line of their own (#893), the touch pad
read them from the help line's default, which is now empty on most screens.
A friend on a phone had no DROP in the raid's pack, no FULL REPORT on the
raid's result, and no OUT, LOCK or pockets in YOUR THINGS, and the lines still
named keyboard letters ("X drop", "L full report", "BKSP out").

The keys line now carries its own words (`data-keys`), the pad reads it
(`screenKeyLines` in `src/game/ui/menuWords.ts`), and a help line also reads
"BKSP out" (OUT on Backspace) and "Q E tab" (the pair `< TAB` and `TAB >`).

YOUR THINGS then names eleven keys with the harbour's seven, and the tray
across an upright phone held eight: the third row was drawn under the d-pad.
The tray now takes a third row over itself where the phone has the room
(the menu gets the rest), with the extra keys on top so the harbour's own keys
never move; where there is no room (a small iPhone, a phone on its side) the
keys are drawn shorter instead.

- `before-pack.png`, `after-pack.png` - the raid's pack: DROP on the tray, and
  "[DROP]" in the lines.
- `before-result.png`, `after-result.png` - the raid's result: FULL REPORT.
- `before-things.png`, `after-things.png` - YOUR THINGS upright (412x915).
- `after-things-small-iphone.png` (375x667) and `after-things-sideways.png`
  (915x360) - the shorter keys where there is no room for another row.

Made touch only on a test-mode build (`?testmode=pixels`) with the devices in
`tools/playtest/phone.mjs`; the raid was deployed by `deploy.mjs` and
everything after it pressed on the pad.
