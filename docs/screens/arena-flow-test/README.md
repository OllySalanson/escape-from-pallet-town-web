# The Arena, walked end to end

A focused test on 31 Oct 2026: the trailer's Charizard ending, the hall, bench, rack, locker, rim, jump, a raid and home, on a new save with next to nothing discovered, at 1200x768 and 640x480.

- `before-locker.png`, `after-locker.png`: a secured Pokémon's tick on a line of its own, and a blank white block in the picture under the list. One tag now, and the block has gone.
- `before-rack-640.png`, `after-rack-640.png`: with a Hauler frame on, the pack's pane had no room for six squares beside its scrollbar, so it drew a sideways scrollbar. The cursor also opened on DONE (`before`); it opens on the first supply now (`after`).
- `before-result-640.png`, `after-result.png`: every raid ending comes home to the Arena's rim, and the button said the harbour.
- `before-rim-empty-bench.png`: with nobody on the bench the hunter line said "1 Pokémon to your 1". It says "one Pokémon for each of yours" now.

`tools/playtest/arenaHall.mjs` and `tools/playtest/arenaIntro.mjs` play the same walk; the second still looked for the old loadout screen and is mended.
