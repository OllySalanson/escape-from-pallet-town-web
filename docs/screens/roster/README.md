# The roster, played

Both frames are `?testmode=pixels` at 3x, taken with the loop handed back to
the clock for a second - the sprite entrance and the HP plate are wall-clock
tweens, so a stepped frame catches them half off screen.

## `caterpie-vs-diglett-3x.png`

A wild **Caterpie** (#10) against a **Diglett** (#50), which is the whole import
in one picture: two species that did not exist in this game before, one drawn
from its front sprite and one from its back, each with the typing generation III
gives it (`WILD BUG`, `YOURS GROUND`) and the stats the snapshot brought in.

## What was played to check it

One browser, `?testmode=1` for the logic and one plain-URL pass at real speed,
per `tools/playtest/README.md`:

- **Met and fought** Caterpie, Weedle, Oddish, Bellsprout, Diglett and Psyduck
  across Pallet Town and Viridian Forest, each with the moves and the ability
  its own dex entry gives it - a Caterpie's String Shot and Shield Dust, a
  Diglett's Sand Attack and Sand Veil, an Oddish's Absorb and Chlorophyll.
- **Caught** a Diglett and banked it: `EXTRACTED · SOUTH GATE ... Banked Diglett
  and Bulbasaur`, and the vault read back the same three Pokemon after a reload.
- **Evolved** one in the field: a level-15 Bulbasaur crossed 16 in the forest
  and came home as an Ivysaur, which is also what found the secure-container
  crash fixed in this branch.
