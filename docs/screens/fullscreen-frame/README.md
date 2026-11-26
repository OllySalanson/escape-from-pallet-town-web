# The frame round the game, and FULL SCREEN

The captain, 26 Nov 2026: on a big screen the game sat in a smaller window with flat black round it. Of the three ways offered (stretch it, show more world, or keep the pixels crisp with a full-screen button and a designed frame), the pick was the third. The stage's whole-pixel sizing and its `MAX_STAGE` limits are unchanged; what is left of the window is now a frame in the game's own pixel (`display/stageFrame.ts`), and FULL SCREEN is a tile on the controls bar, the frame's own button where the bar has no room, a SETTINGS row and ALT ENTER (`display/fullScreen.ts`).

- `before-yard-1920x1080.png`, `before-yard-2560x1440.png` - flat black margins; at 1920 the bar's tiles ran past the game on both sides, and at 2560 there is no bar at all.
- `mock-bezel-…`, `mock-balls-…`, `mock-opened-…`, `mock-handheld-…` - the four designs drawn first over the real game picture. A fresh critic that had not made them ranked the bezel first (quiet, in the menus' five colours, cheap); the opened Poke Ball was the strongest idea but glared beside a night-time game, the tiled balls read as a knitted jumper, and the console shell was a costume the game never wore. Its refinements were all taken: everything on the game's grid, the bar wrapped inside the ring, studs only where they fit, the opened ball's belt kept but quiet, nothing on thin strips, and the button never squeezed.
- `after-yard-1920x1080.png` - the bezel: ink field with a dot lattice counted from the game's corner, a ring of ink, red and ink round the game and the bar, the Poke Ball's belt at the game's middle with its button in each margin, and the bar as wide as the game with FULL SCREEN beside SETTINGS.
- `after-full-screen-on-1920x1080.png` - full screen on: the tile's corners point in and it is lit.
- `after-yard-2560x1440.png` - no room for the bar, so the frame holds the FULL SCREEN button top right.
- `after-yard-3440x1440.png` - an ultrawide: the bar stood up on the left, the belt's left button in what the bar leaves of the margin.
- `after-yard-1280x800.png`, `after-title-1920x1080.png` - a laptop's thin strips get the ring and the lattice only; the title.

Made with `node tools/playtest/frameShots.mjs <test-mode build url> <dir> --sizes=…` against a test-mode build served under the Pages subpath; it also plays FULL SCREEN by the tile and by ALT ENTER, in and out (`tile true/false, ALT ENTER true/false` at 1920x1080 and 2560x1440). The mock-ups were static pages over the before pictures.
