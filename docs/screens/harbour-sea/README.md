# The sea moves, and the harbour sounds like one

Round 3 of the badass harbour.

## What changed

- **The sea ripples, the surf laps the cove and the flowers sway exactly as FireRed's do.**
  `scripts/cut-frlg-tile-anims.mjs` renders FireRed's own tile animations (the general tileset's
  `water_current_landwatersedge`, `sandwatersedge` and `flower` frames, timed as
  `TilesetAnim_General` times them) from pret's disassembly for every cell of the game's ground
  sheets they match pixel for pixel, and the harbour swaps those tiles on one shared clock
  (`src/game/world/tileAnimation.ts`). Frame 0 is the cell as it was always drawn.
- **THE COVE is a real beach**: a strip of sand against the green and the surf only where the sand
  meets the sea (it used to draw surf on every side, against the grass and the quay too).
- **Sound**: the Seagallop sounds her horn (`shipHorn`) when a raid comes home, and now and then,
  within five steps of the water, you hear the sea lap at the quay (`waveLap`). Audition both on
  the Test Lab's sound board (`?test-lab=1` on a dev build).

`clip-the-sea-moving.png` is a two-second animated PNG of the cove at real speed.

## How to use it

Come home from a raid and listen for the horn; walk along the quay or down to the cove and watch
the water.
