# Floodplain Relay at 128x128

Thirteen new places, photographed in the real game at 3x (`?testmode=pixels`,
WebGL - the Canvas test renderer draws no tints, so the water and the tall grass
would come out as lawn). Each one is the player standing in the middle of the
district with the arrival plate up:

```bash
nice -n 15 node tools/playtest/tour.mjs "http://localhost:$PORT/" out \
  quarry:80:12 kilns:105:12 beck:66:28 cider:76:40 levels:110:60 \
  hundred:47:76 withy:80:80 staithe:23:105 wall:90:100 breach:90:112 \
  muds:20:118 light:115:110
```

## What the pictures decided

**`staithe-before.png` / `staithe-after.png`.** THE STAITHE is a wharf, and it
was drawn in **hedge**. On this sheet a hedge is a round bush, so the wharf came
out as thirty screens of bush maze with paving lanes cut through it - a place
that measured perfectly well on `tools/tileset/density.mts` and read as
countryside where a town should be. It is drawn in **wall** now: the same
collision, the same lanes, the same yards, and it reads as somewhere that was
built. This is the fault a measurement cannot see, and it is why a new district
is photographed before it is believed.

**`withy.png` and `cider.png`** still have that fault, and are named as the
weakest thing on the new ground rather than quietly shipped: a uniform field of
bushes with lanes in it. What they want is a second material that is not green.

**`hunter-caught.png`.** The hunter arriving on the wharf and closing to one
tile, which is the moment before FOUND YOU. Worth writing down because a driver
gets it wrong: the hunter takes a share of a step for every step the *player*
takes (`aggressionStepsPerPlayerStep`, spent in `WorldScene.advanceStep`), so
standing still to be caught is standing safe - see `tools/playtest/README.md`.

## The rest

| | |
|---|---|
| `quarry.png` | the top bench, the incline head, and the flooded pit below it |
| `kilns.png` | three draw kilns cut into the rock face, the tram yard in front |
| `beck.png` | the wooded cleft, with the beck turning through it |
| `levels.png` | drained fen: parallel drains, the drove, and LENGTHSMAN QUILL's watch on it |
| `hundred.png` | a parish of hedge banks standing in a foot of water |
| `wall.png` | the sea wall's crest above the lagoon the breach made |
| `breach.png` | where the crest drops to the sands |
| `muds.png` | sand bars and the gutways between them, at low water |
| `light.png` | the pier running out from the point |
