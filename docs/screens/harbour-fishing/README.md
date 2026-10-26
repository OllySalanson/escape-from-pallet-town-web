# Fishing off the harbour

Round 11 of the badass harbour. Firstmate's brief for it: play the whole harbour as a brand-new
player, then build the next most player-delighting thing - something to do on the quay, a reason
to walk the long pier.

## Played as a newcomer first

A fresh save, start to finish, through the real game: arrive, the keepers, the Raid Arena, a raid
on the first contract (a fight, the stop, out by Pickers' Path) and home onto the jetty beside the
Seagallop - by day in a stepped test-mode build, and at real speed in a production build at night.
No errors and nothing broken; the one thing a newcomer had no way to find was anything to *do* in
the harbour between raids, which is what this round adds.

## What changed

- **The angler lends his rod.** Speak to him at the end of the cove's jetty and he hands it over:
  face the water anywhere in the harbour and press SPACE to cast (the hint says `[SPACE] FISH`).
  A player with a rod of their own from Bill needs no loan.
- **FireRed's cast, the harbour's rules.** The cast, the dots and the coin are the raid's own
  fishing (`world/fishing.ts`), but the harbour is safe, so a bite is reeled in, named and let go:
  no fight, nothing won, nothing spent (`src/game/base/harbourFishing.ts`).
- **A reason to walk the long pier.** Along the foot of the quays only Magikarp bite (FireRed's Old
  Rod water off Pallet Town); out where it's deep - off the end of the long pier and the
  breakwater - Horsea and Krabby bite too (its Good Rod water).
- **The angler keeps a tally** of the kinds you've had out of the harbour (`harbourCatches` in the
  save, optional, no version bump): "You've had 2 of 3 kinds out of the harbour: HORSEA, MAGIKARP."
- The cove's sign says the angler lends his rod. FireRed's float is drawn by one shared painter
  now (`world/fishingFloat.ts`), for the raid and the harbour alike.

## How to use it

Walk to the end of the cove's jetty and talk to the angler. Then fish anywhere along the water -
and walk out to the end of the long pier for the good ones.
