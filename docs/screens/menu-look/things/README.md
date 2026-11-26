# YOUR THINGS: the stash grid

Olly, 25 Nov 2026, on the round-3 mock-ups: "for your stash, I love this. This is exactly the
sort of thing that I want ... the design of it with the squares, how you can drag things around,
just like Tarkov." Decided under his "go with your recommendation": the stash grid (not cards),
a spare row always waiting at the bottom, and a green rosette for the partner.

- `before.png` - the side panel on `main`: pocket icons over a list of rows, the pack beside it.
- `after.png` - the stash as squares, each thing as big as it is with its count; the raid pack
  (red, AT RISK, 8 OF 18) and the locker (green, SAFE, the partner with its rosette) beside it;
  what is in hand along the foot, with the keys in its buttons.
- `after-dragged-into-pack.png` - an Old Rod dragged from the stash and let go in the pack's
  corner: packed, standing where it was let go, the count up to 11.
- `after-balls-tab.png` - E lit the BALLS tab: the balls stay bright and everything else stands back.
- `after-in-the-hall-1200x768.png` - B in THE RAID ARENA's hall, with the hall's own Ranger pack.

Made against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`) at 1280x800:
`node tools/playtest/menusAudit.mjs <url> <out> --only=your-things` for `before`/`after`, a
scratch driver of mouse drags over CDP for the drag and tab pictures, and
`node tools/playtest/yourThings.mjs <url>?testmode=pixels <out>` (1200x768) for the hall.
