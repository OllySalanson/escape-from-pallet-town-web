# The site plan

A festival-style site plan of Greystone Vale that zooms from the whole world down to single tiles: a lettered grid, every place outlined and named, every building, door, exit and feature named on hover, a panel of everything each place holds, and a filter that lights up where a Pokémon or a type lives. Made by `npm run site-plan` (`tools/sitePlan/`), which writes `out/site-plan/index.html` with its `tiles/` and `sprites/`; open the page straight from disk.

Photographed in Playwright's headless Chromium against that page, with the view set by the page's own address (`index.html#x,y,scale`: the centre in tiles and the screen pixels to a tile), and what is chosen set through the page's `window.__sitePlan`.

- `1-whole-world.png` (1440x900, `#` none - the page's own fit): the twelve-by-twelve grid, the three quarters washed in their colours, every district named, the ways out and landings, and the block of interiors to the east.
- `2-districts.png` (1440x900, `#150,166,3.2`): a dozen districts, with the places inside them named, the green way-inside badges on every door you can walk in, and the rulers pinned to the window's edge with tile numbers between the letters.
- `3-tiles.png` (1440x900, `#103,156,30`, pointer over Millbrook Center): Mill Square tile by tile in the game's own art, grid squares named in their corners, and the hover card - kind, name, the places it is in, its grid square, and where its door goes.
- `4-phone.png` (390x844 at 2x, `#160,180,2.2`, Gull Strand chosen): the phone layout, with the key folded away and a chosen place's panel at the foot.
- `5-place-panel.png` (1440x900, The Frozen Lagoon chosen and flown to): a place's panel - what its water gives each rod, who stands there (Articuno marked as the legend), and below the fold its only-here finds, its ice, and the rules every number is read by.
- `6-filter.png` (1440x900, `Pikachu` typed in the filter, then SHOW THEM ALL): every place a Pikachu can be met lit up and the rest of the map under paper, with the Pikachu that stand on the map ringed.
- `7-inside.png` (1440x900, `#100,170,9`, then through the Greystone Caves door and its room chosen): inside a building - the cave's panel with what its floor rolls by day and by night, and BACK OUT under the zoom buttons.
- `8-phone-panel.png` (390x844 at 2x, `#103,160,6`, The Tarn chosen): the panel on a phone, scrolling inside its own box, with the Tarn's secret and the exact raid it waits for.

How the zoom and the clicks feel is measured, not photographed: `node tools/sitePlan/playSitePlan.mjs out/site-plan/index.html` plays the page with real wheel, trackpad, pinch, mouse and touch input and prints each check.
