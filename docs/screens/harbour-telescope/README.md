# THE POINT's coin telescope

The owner, 27 Nov 2026: "This telescope in the harbour looks a bit peculiar." It was a thin gold tube floating at an angle on a bare pole, standing in the gap of the lookout's railing.

## Before

`before.png`: the tube on its pole in the railing's own row, the rail broken either side of it.

## After

`after.png`: a seaside coin viewer, two lenses turned out to sea under a chunky head with its eyepieces at the back, a coin box with a gold slot plate, a stout post and a foot bolted to the paving. It stands on the lookout's paving between the two benches, the same row they stand on, with the railing running unbroken in front of it. `after-read.png`: it is read from the walk behind it, facing the sea, as it was before (`COIN_TELESCOPE` in `src/game/base/baseMap.ts`).

## How they were made

`node tools/playtest/harbourTour.mjs <test-mode build url>?testmode=pixels <dir> --built=all --clock=day --at=lookout:120:14,near:122:13` against a test-mode build (`tools/playtest/README.md`, "Memory"), before and after the change. The art is `coinTelescope()` in `scripts/draw-promenade.mjs`, written onto `public/assets/promenade.png` by `node scripts/draw-promenade.mjs`.
