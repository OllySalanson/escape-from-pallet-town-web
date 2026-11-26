# A long word on a touch pad key is never cut off

The pad's keys are a quarter of the phone across, and the pad's words are
Orange Kid at a whole-device-pixel size near 18 CSS pixels. On a 375-wide
iPhone that cut off FULL REPORT ("FULL REPOR"), TOSS A COIN, YOUR NAME and
SHELVES/BAR, and on a 412-wide Android FULL REPORT and SHELVES/BAR.

A key now measures its word (`fitChipWords` in `src/game/ui/touchPad.ts`):
one line as designed; two lines at the same size where one would run past the
key's edges, breaking at a space or after a slash; and one stem thinner
(`padSmallTextSize`, still on whole device pixels) only where two lines are
taller than the key, which is a key drawn short on a phone on its side.

- `before-full-report.png` - the raid result's FULL REPORT key on a 375x667
  iPhone at 2, on one line as main draws it.
- `after-full-report.png` - the same key with this change.

Made on a test-mode build (`?testmode=pixels`) with the small iPhone of
`tools/playtest/phone.mjs`. The raid was deployed by `deploy.mjs` and played
to its result on the pad. The before picture is the same key with its new
class taken off on the page, which is main's one-line rendering exactly
(85 pixels of word in a 75-pixel key).
