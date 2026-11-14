# The site plan

A festival-style site plan of Greystone Vale that zooms from the whole world down to single tiles: a lettered grid, every place outlined and named, every building, door, exit and feature named on hover. Made by `npm run site-plan` (`tools/sitePlan/`), which writes `out/site-plan/index.html` and its `tiles/`; open the page straight from disk.

Photographed in Playwright's headless Chromium against that page, with the view set by the page's own address (`index.html#x,y,scale`: the centre in tiles and the screen pixels to a tile).

- `1-whole-world.png` (1440x900, `#` none - the page's own fit): the twelve-by-twelve grid, the three quarters washed in their colours, every district named, the ways out and landings, and the block of interiors to the east.
- `2-districts.png` (1440x900, `#150,166,3.2`): a dozen districts, with the places inside them named, and the rulers pinned to the window's edge with tile numbers between the letters.
- `3-tiles.png` (1440x900, `#103,156,30`, pointer over Millbrook Center): Mill Square tile by tile in the game's own art, grid squares named in their corners, and the hover card - kind, name, the places it is in, its grid square, and where its door goes.
- `4-phone.png` (390x844 at 2x, `#160,180,2.2`, Gull Strand chosen): the phone layout, with the key folded away and a chosen place's card at the foot.
