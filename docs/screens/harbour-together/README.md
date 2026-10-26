# Two players in the new harbour, and the Seagallop's log

Round 15 of the badass harbour.

## What changed

- **Played with two players** (two tabs over the shared harbour's local stand-in,
  `tools/playtest/sharedHarbour.mjs`, which now takes `--port=` to drive a watched browser): both
  see each other with their names, follow each other's walks, and meet in Oak's Lab. One fault:
  a building's caption was seated across the other player - the rule that keeps captions off the
  harbour's own people did not know about them. `HarbourFigures.rects()` now tells the caption
  seating where every other player and their name plate stand.
- **The Seagallop's sailor keeps her log** (`src/game/base/seagallopLog.ts`): spoken to, he reads
  out how many times she has run you out on a raid and how many of those she brought you home with
  your haul - read off the raid record the save already keeps, every map's.

## How to use it

Talk to the sailor beside the jetty after a few raids. Play with a friend in the harbour and
watch the names stay clear of each other.
