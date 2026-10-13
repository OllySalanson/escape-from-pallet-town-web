# A scrollbar for a pixel

The owner's playtest on 2026-10-13: PLAYTEST, Oak's Lab, Greystone Vale, REVIEW &
DEPLOY, in a 1890x890 window on Windows. LOST IF YOU WIPE was one thin strip with
its three entries cut through their middles, a MORE strip and a scrollbar, over
an empty screen.

Photographed against a `VITE_EPTW_TEST_MODE` build with Chromium's scrollbars
drawn (`menuShots.mjs --scrollbars`, which is what Windows does by default; the
tools hide them unless asked, which is why no earlier shot showed this).

**Why.** Orange Kid's content area is deeper than the 12-pixel line every row is
set on, so the last row of a list overflows its pane by a screen pixel. Nothing
is drawn there, and `hasMoreBelow` already called it rounding. But a browser
that draws scrollbars drew one for it. That bar took the width the three columns
had been counted in, so the list scrolled sideways too. The second bar took the
height, and then the MORE strip covered the rest.

**Fix.** A pane whose overflow is under a game pixel, measured against the box
it stands in, is `data-flush` (`fitsItsBox` in `ui/MenuOverlay.ts`) and clips
instead of scrolling. It clips where a scrolling pane clips, so with scrollbars
hidden every screen `menuShots` photographs is pixel-identical before and after.

- `before-final-check-1890x890.png` / `after-final-check-1890x890.png`: the
  owner's screen. The clock line also says what an explorer run's clock is: it
  is eight hours on purpose, and the chip says PLAYTEST rather than count it.
  The line used to say `night raid clock 480:00`.
- `after-final-check-1366x768.png`: three entries in two columns, all of them whole.
- `before-loadout-1890x890.png` / `after-loadout-1890x890.png`: the same fault
  in the pack, one step earlier. It showed a row and a half of its grid and
  `1 MORE`.
- `before-dropin-1890x890.png` / `after-dropin-1890x890.png`: a needless
  scrollbar beside the DROP IN AT list.

`menuShots.mjs` now fails a pane that scrolls by a pixel or sideways. It is clean
with `--scrollbars --raid` at 1890x890, 1280x800, 1920x1080 and 1366x768.
