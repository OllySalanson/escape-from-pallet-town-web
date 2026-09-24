# Bill's lists at the smallest stage

Photographed with `tools/playtest/menuShots.mjs --window=640x480` against a
`VITE_EPTW_TEST_MODE` build. At that size the menu is 320x240 game pixels, which
is the `tight` room.

- `before-640x480.png`: the fold ran through the Poké Ball on his shelf, and the
  table had no whole row either. `menuShots` reported `px-list 0/5` and
  `px-list 0/12`, with `ROW CUT` on both. The blank cream band under
  STANDING · STRANGER is where the room went. The tight rule `padding: 0` on
  `.trader-standing` never applied, because `.pixel-ui .px-window` outranks
  anything scoped through `:where()`.
- `after-640x480.png`: his standing is now just its strip, 16 pixels. His three
  windows sit two pixels apart instead of four. Each list gets a measured floor
  (shelf 92, table 76) rather than a straight seven-to-six share, so each shows
  one whole row above its MORE strip. `menuShots` reports `1/5` and `1/12` and is
  clean. `shopScreens` is clean at the same size.
- `narrow-1024x640-not-fixed.png`: **not fixed here.** The `narrow` room has the
  same fault with his two lists side by side. It shows at 1024x640 (504x312 game
  pixels) and gets worse at 856x616 (420x300), where the shelf list is 9 pixels
  tall and the table's first row is 64. Fixing it means deciding what Bill drops
  in the two-column layout: his standing sentences and figure, the detail bands,
  or the berth's heading. That choice is left for its own change.
