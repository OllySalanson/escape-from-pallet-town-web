# Interiors: THE DELVE, under Pallet Town's quarry hill

The first roofed place in the game (`src/game/world/interiors.ts`): the same map
with a lid on it, rather than the tutorial's second scene behind a portal.
Photographed in the real game at 3x with `tools/playtest/tour.mjs` and
`tools/playtest/interior.mjs`, both deployed to `--insertion=pallet-quarry`.

## From outside

| | |
|---|---|
| `tour-hill-from-the-hanger.png` | The knoll from THE HANGER: a crown of rock fading to scree, one stone gap at its shoulder, and `THE DELVE` named beside it. There is no way to tell from the picture how much is behind it, which is the point. |
| `tour-hill-from-the-quarry.png` | The same hill from the quarry road, and its other mouth. Two mouths is the rule, not the decoration - see the header of `interiors.ts`. |
| `interior-outside.png` | The lid at full alpha, standing one step off the west mouth. |

## From inside

| | |
|---|---|
| `tour-delve-mouth-hanger.png` | Standing in the west mouth. The lid is already off: a mouth is the first tile of the inside. |
| `tour-delve-level.png` | The shored level, driven south through the rock. |
| `tour-delve-working.png` | The old working - the three-tile chamber the quarrymen left. |
| `tour-delve-gallery.png` | The gallery on the quarry side, and the corridor that joins the two. |
| `tour-delve-mouth-quarry.png` | The east mouth, on the quarry floor. |
| `interior-inside.png` | The lid at zero alpha with the dim veil under the figures: the floor is dark and whoever is standing on it is not. |

## What the pictures were drawn against

Both faults below were found by looking rather than by reasoning, which is the
rule `AGENTS.md` records for THE STAITHE.

- The **first** lid was one material filled over a rectangle, and every wall
  material on this sheet is an *overlay* - one rock drawn over whatever ground
  is beneath - so the hill was a scatter of boulders with the cave showing
  between them. A lid is two layers now, and the top one is **drawn** as
  character art per tile (`MapInterior.lid`), for the same reason the maps are.
- The **second** was the caption. A lid is drawn above the captions exactly as
  a tree's crown is, so the quarry-side mouth's own name came out half washed
  out under the hillside it was naming. A lid is forbidden ground for a caption
  now, and a mouth's caption is anchored on the mouth *and the ground outside
  it*, so it has somewhere left to sit.

## What `interior.mjs` reports

```
THE DELVE on this map, 2 mouths
standing outside at { x: 43, y: 22 } lid alpha [ 100, 100 ]
standing in the mouth  lid alpha [ 0, 0 ]
standing inside at { x: 45, y: 22 } lid alpha [ 0, 0 ]
hunter outside - hidden from it: true
and it is walking to      : {"x":43,"y":22} (the player is at {"x":45,"y":22})
hunter in the mouth - hidden from it: false
with the hunter in that mouth, the other one is 16 steps away
back outside     lid alpha [ 100, 100 ]
the floor rolls for wildlife: true
```

Line by line: the hill comes off when you step in and goes back on when you step
out; a hunter outside is hunting a sighting that is no longer true; a hunter
**in** the cave with you can see you perfectly well; with it standing in the
mouth you came in by there is still a way out, sixteen steps off; and the floor
rolls for a fight on every step of it, which is what the delve charges for being
the short way (nineteen steps against thirty-seven round the hill).
