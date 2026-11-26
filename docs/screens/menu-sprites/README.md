# A menu's pictures, there the first time it opens

The captain, 26 Nov 2026, in Bill's Cottage: "it took a while for everything to
load again" - and the second time he opened the shelf, everything was there at
once. The pictures and the prices (a price for parts is drawn as the parts'
icons) came in late, but only on the first open.

## Why

Phaser's loader fetches every icon and species at boot, but into its own
textures, which an `<img>` cannot draw from. So the first `<img>` for each file
went back to the browser's disk cache, one at a time, and once Pages' ten
minutes (`cache-control: max-age=600`) had passed, to the network: one request
a picture. The second open was quick because the page then held the files.

## The fix

`src/game/ui/menuPictures.ts`: as the game boots, straight after Phaser's own
fetch (so from the cache, not the network), every icon, every species as a menu
stands it and the sheets the stylesheet draws from are loaded once more as an
`Image` and kept for the life of the page. A browser draws an `<img>` at once
when its document already holds the file, and never asks the network for it
again.

## Measured

`tools/playtest/menuSprites.mjs <test-mode build> --cpu=4 --stale` on a build
served as Pages serves it (80ms a request, a 4x slower processor once the game
has loaded, and every file past its ten minutes). It opens Bill's shelf twice
from a page that has only loaded the game, then the raid's result screen, and
times each picture from the moment it is put on screen to the moment it is drawn.

| Screen | Before: pictures late | Before: last drawn | After: pictures late | After: last drawn |
|---|---|---|---|---|
| Bill's shelf, first open (187 pictures) | 185 | 636ms, 6+ requests | 0 | 1-3ms, no requests |
| Bill's shelf, second open | 0 | 0ms | 0 | 1ms |
| The raid's result (5 pictures) | 1 | 102ms, 1 request | 0 | 0ms |

With files still fresh (no `--stale`), Bill's first open was 185 late and 275ms
before, 0 late and 2ms after.
