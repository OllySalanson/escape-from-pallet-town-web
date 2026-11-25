# THE RAID ARENA's rack shows what is on it whole

The captain, 25 Nov 2026: the three things on the rack showed only their bottom half, and the first could not be told for what it was.

The rack's red cloth, like the bench's back and the locker's top, was painted on the hall's layer over figures, because everything a station drew above its own row went there (`stationPut` in `scripts/draw-arena-hall.mts`). What stands on the rack (`ArenaFurniture`) is drawn as a figure on the rack's row and rises eight pixels into the row above, so the cloth covered the top half of each: the raid pack, a Potion and a Poke Ball. Nobody can pass behind a station - the row behind each is wall - so the three are now painted wholly on the floor, and the pack reads as a pack.

- `before-at-the-rack.png`: before, half a pack, half a Potion and half a Poke Ball.
- `after-at-the-rack.png`: after.

Both are `node tools/playtest/arenaFlow.mjs <url> <out> --shots` against a test-mode build (`at-rack.png`), on a new save with Charmander.
