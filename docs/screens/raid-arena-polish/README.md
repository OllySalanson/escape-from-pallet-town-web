# THE RAID ARENA, polished

Played by `node tools/playtest/raidArenaPolish.mjs <test-mode build url> <out dir>` at the 3x window.

- `1-hall-mat.png` - a new game on the hall's mat: BENCH, RACK and LOCKER on plates over each station, read from the door. The plates are painted by `scripts/draw-arena-hall.mts` in the Arena's own five-pixel capitals, on the badge its front puts ARENA on. Charmander stands beside the player, not on the tile below.
- `2-rack-up-close.png`, `3-bench-up-close.png` - walked up to, a station's caption still says what it holds, and is seated clear of its plate (`STATION_PLATE_RISE`).
- `4-charizard-yard-spawn.png`, `5-charizard-hall-mat.png` - the explorer run's level-99 Charizard, which used to arrive on the tile below a player who had walked up onto the mat and stand over all but their head (`arrivalPlace` in `src/game/base/partner.ts`).

The locker now secures the partner before any higher-level Pokemon (`src/game/hub/secureAutofill.ts`); the driver checks it with a level-30 Pidgey on the bench beside a level-5 Charmander.
