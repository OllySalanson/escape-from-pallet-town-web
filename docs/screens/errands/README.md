# Errands

The contract board is work from nobody in particular. An errand is a favour
asked by one of the four people at base, in their own building, and the thing
they want is real: it lies in one place on one map, takes its squares in the
pack like any find, and is lost with the pack. `src/game/hub/errands.ts` holds
the four and the rules; the captain's own idea spark was "when Brock asks you
to fetch a parts crate, the crate is real and takes four squares; doing a
favour means leaving loot behind, and a wipe means telling Brock you lost it".

| Who | Wants | Where | Squares | Pays |
|---|---|---|---|---|
| Professor Oak | Oak's Parcel (FireRed's own errand) | CENTER SQUARE, Viridian City | 2 | five Poké Balls (FireRed's own) |
| Nurse Joy | her medicine bag | THE STEADING, Route 1 | 2 | Leftovers |
| Brock | his crate of tools | THE QUARRY, Pallet Town | 4 | TM39 Rock Tomb (FireRed's own) |
| Bill | Old Amber (FireRed's) | SAP POOL, Viridian Forest | 1 | an Eevee (Bill's gift in HeartGold/SoulSilver) |

Shot at 3x (1200x768) against a test-mode build. The raid half is
`tools/playtest/raid.mjs --insertion=town-square --errands=brocks-crate
--grab=brocks-crate --shot=... --save-out=save.json`, and the base half is
`tools/playtest/errands.mjs <url> <dir> --save=save.json`, which hands over the
crate that raid really banked and fails on any beat that is not what it promises.

- `1-joy-asks.png` - walking into the Pokémon Center: Nurse Joy asks, once.
- `2-lab-board.png` - Oak's board lists every errand in hand under the
  contracts: what, for whom, where, and its squares. A row is the drop-in.
- `3-dropin.png` - the drop-in screen names the errand on the map in view.
- `4-crate-in-the-quarry.png` - Brock's crate in the quarry, lit like a prize
  and named on the HUD once seen.
- `5-no-room.png` - a full pack refuses it, with the crate still on the ground:
  the favour costs loot.
- `6-four-squares.png` - carried: four of the pack's eighteen squares.
- `7-result.png` - walked out with it: the result screen says who to take it to.
- `8-brock-thanks.png` - walking into the workshop hands it over, in FireRed's
  words for TM39.
- `9-crate-on-the-bench.png` - and it stands on Brock's bench from then on.
- `10-oak-lost.png` - Oak's parcel was found and lost with a pack: he asks after
  it, once, and another is laid on the next raid.
- `11-yard.png` - the look key in the yard: a door says when its keeper has a
  favour to ask, a thing to take, or wants a word.
