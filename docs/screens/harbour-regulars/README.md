# The harbour's regulars

Twelve regulars walk THE HARBOUR the way players do (`src/game/base/harbourBots.ts`),
two to six of them at a time. Both pictures are `tools/playtest/harbourRegulars.mjs`
against a test-mode build, at the game's 3x window.

- `the-yard.png` - from the spawn: JUNO and her Wartortle by the Raid Arena, ARLO and
  his Blastoise by the square. ARLO is walking down the yard with Blastoise behind
  him, so his name plate sits on top of Blastoise rather than under it
  (`clearOfHeel` in `base/harbourFigures.ts`, which real players get too).
- `spoken-to.png` - FINN on the cove, spoken to: he stops, turns to the player, waves
  back once the player's own hand is down, and says his line.
- `calling-on-oaks-lab.png` - ROWAN calling on Professor Oak, at the lab's shelves with
  his Squirtle at heel. He walked in off the mat and will be back on it as his call ends;
  only one regular calls on a room at a time, and only while the yard keeps two.
