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

## Its own front (2026-10-29)

The captain: "making new Sprite for the raid arena so we're not just reusing the gym one basically
maybe where it says Gym it can say Raid and then have a badge on the other side saying Arena".

| Picture | What it shows |
|---|---|
| `front-before.png` | The Arena as it was: Saffron's Gym, GYM plate and all, with the CC0 purple banners. |
| `front-after.png` | Its own front: RAID on the plate, a gold ARENA badge across the door, the emblem red and the door lit, lanterns, a flag at each end of the roof and a Poke Ball painted on it, RAID-red banners, a Poke Ball on each statue's plinth where it said GYM, and a red runner from the door between the statues. |
| `front-day.png`, `front-night.png` | In game, at the real 3x window, by day and by night (the windows light from dusk). |

`front-before.png` and `front-after.png` are crops of `tools/base/renderBase.mts -- <png> 2`; the
two in game are `tools/playtest/harbourTour.mjs --clock=day|night --at=arena:8:15`. The art is
drawn by `scripts/draw-raid-arena.mjs` - edit that, not the PNG.
