# The harbour's regulars

Twelve regulars walk THE HARBOUR the way players do (`src/game/base/harbourBots.ts`),
two to six of them at a time, each doing something (`src/game/base/harbourActivities.ts`).
The pictures are `tools/playtest/harbourRegulars.mjs` and `tools/playtest/regularsActivities.mjs
--shots=chat,knock,watch-sea` against a test-mode build, at the game's 3x window.

- `the-yard.png` - from the spawn: JUNO and her Wartortle by the Raid Arena, ARLO and
  his Blastoise by the square. ARLO is walking down the yard with Blastoise behind
  him, so his name plate sits on top of Blastoise rather than under it
  (`clearOfHeel` in `base/harbourFigures.ts`, which real players get too).
- `a-chat.png` - XKITX and BEEBEE22 stopped to talk on the green: the bubble takes the place of
  the name (hers gives way too, being under it), and comes back when it has been said.
- `a-knock.png` - TESS-SWIMS on BROCK'S doorstep with her hand raised, waiting. Nobody hears it.
- `watching-the-sea.png` - BULBALUV at the end of the jetty, turned to wave at the player
  coming near, with XKITX and OZ-HIKES crossing the forecourt behind.
- `calling-on-oaks-lab.png` - ROWAN calling on Professor Oak, at the lab's shelves with
  his Squirtle at heel. He walked in off the mat and will be back on it as his call ends;
  only one regular calls on a room at a time, and only while the yard keeps two.
