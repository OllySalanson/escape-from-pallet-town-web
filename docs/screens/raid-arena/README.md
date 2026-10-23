# The Raid Arena, and a roomier harbour

The captain, 2026-10-23: "add a raid arena into the harbour on the western side which looks super
cool and you go into it and then that's when the loadout screen goes and that's how you get into
Raids ... Also I feel like there needs to be a bit more space, more open space, all the pathways
need to be a bit wider."

| Picture | What it shows |
|---|---|
| `harbour-before.png` | The harbour as it was: 51x21, one-tile hedges between the buildings, a four-row yard, raids started in Oak's Lab. |
| `harbour-after.png` | The harbour now: 64x24, two tiles of lawn between every pair of buildings, a five-row yard, and the Raid Arena on its stone forecourt at the west end, beside the jetty and Bill's cottage. |
| `arena-step.png` | In game, on the Arena's step after backing out of the loadout. |
| `arena-loadout.png` | Through the Arena's door: the loadout, with YARD as the way back. |
| `oaks-lab.png` | Oak's Lab now: a card saying where raids start, the team, and the contract board, none of which starts a raid. |

The two harbour pictures are `tools/base/renderBase.mts -- <png> 2 --built=all`; the three in game
are `tools/playtest/raidArena.mjs`, which plays the whole loop against a test-mode build.
