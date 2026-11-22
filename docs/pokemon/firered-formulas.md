# FireRed's stat, damage and accuracy formulas - what they moved

The captain's ruling of 2026-11-22, after a playtest found the stats on THE
BENCH at about half of FireRed's: "just do everything on Fire Red now and get
rid of the old Unity stuff". Three battle rules were still the Unity original's,
which took them from a tutorial. All three are now FireRed's own, read off
pret/pokefirered:

| Rule | Was (Unity) | Is (FireRed) | Where |
| --- | --- | --- | --- |
| Stats | `floor(base * level / 100) + 5`, about half of canon | `CalculateMonStats` with no IVs, no EVs and a neutral nature | `Pokemon.ts` |
| Damage | `(2L + 10) / 250 * power * A / D + 2`, times a roll of 0.85-1.0 | `CalculateBaseDamage` then `damagecalc`, `typecalc` and the roll, floored at every step; the roll is 85-100 in sixteen steps | `battle/damage.ts` |
| Accuracy and evasion | two separate `3/(3-n)` ladders, multiplied | one stage (accuracy less evasion) on `gAccuracyStageRatios`, floored | `battle/statStages.ts` |

The status-move accuracies the Unity original had at 100 are FireRed's too:
Sing 55, Supersonic 55, Poison Powder 75.

Stats are derived, so no save changed. A Lv 28 Ivysaur reads 71 HP and 39
Attack where it read 54 and 22 (`docs/screens/firered-formulas/`).

## What it moved

FireRed's scale spreads the species apart where the old one squeezed them
together, and the whole-number damage takes up to a fifth off an early hit.
Everything this game measures over the real engine was measured again:
`tools/hunter/measure.mts`, `tools/trainers/report.mts` and `tolls.mts`,
`tools/encounters/firstRaid.mts`, `tools/arena/ladder.mts` and
`newcomer.mts`, `tools/weather/measure.mts`, and every table the habitat tests
hold. Anything that broke a promise a test holds was retuned, and the comment
on each change says so.

### Retuned

| Where | What broke | Change |
| --- | --- | --- |
| Hunter leads (`world/hunters.ts`) | Koga's Grimer: a lone Lv 10 Squirtle won 40% on the last rung (floor 60%); his Koffing 29% | Koga leads Venonat (68% at worst); Sabrina's Drowzee is back (63%) |
| Foreman Rudd | a rung easier than the sluice keeper (76% vs 63%) | Geodude 11 → 12 (69%) |
| Raider Maya (Floodplain) | two Pidgey free for Charmander, whose Scratch rounds a point above a Tackle | + a Lv 4 Sandshrew, whose Defence rounds them the same |
| Koga's gym | the wrong team three levels up won 14% | Grimer 19 → 17 (32%) |
| Boatswain Cragg | a point easier than Misty | Machop 16 → 17 |
| Garden, Safari Zone, Deep Stand | a Lv 8 Squirtle under the floor | the commonest species a level lower |
| THE DELVE (Pallet Town) | a Lv 5 Sandshrew became the wall its Geodude was refused for (0-2% for every starter) | Sandshrew 4-5 → 3-4 (worst roll 72%) |
| The dojo's Black Belts | MIKE easier than his own class's regulars; AARON's Machamp left the best team 3% | MIKE Machop/Machoke/Poliwrath; HITOSHI and AARON lead the prize each hands over |

### Held without a change

Bulbasaur / Charmander / Squirtle unless a row says otherwise.

| Measure | Unity formulas | FireRed's |
| --- | --- | --- |
| Hunter, last rung, early parties: mean / worst / HP left | 95% / 69% / 62% | 95% / 63% / 64% |
| Hunter, last rung, late parties | 91% / 51% / 64% | 90% / 64% / 64% |
| Hunter, last rung, worst early cell with the three Potions | 85% | 81% |
| Tolls (all in `TOLL_BAND`), e.g. Quill at Lv 8 | 86 / 95 / 80% | 97 / 92 / 89% |
| Starter stats at Lv 5 | within 1 point | within 2 (Charmander faster, Squirtle tougher) |
| Pallet's field at Lv 5 | 73 / 90 / 84% | 81 / 93 / 92% |
| The vale's first places at Lv 5 | 76 / 88 / 85% | 80 / 92 / 92% |
| Power Plant at Lv 8 | 87 / 95 / 55% | 93 / 94 / 59% |
| Icefall at Lv 8 | 80 / 90 / 74% | 91 / 67 / 77% |
| Volcano at Lv 8 | 58 / 62 / 82% | 63 / 53 / 79% |
| Stormcrown (summit) at Lv 8, clear | 59 / 91 / 76% | 74 / 88 / 77% |
| Stormcrown, Charmander in rain / by night | 57% / 44% | 47% / 37% |
| Hideout at Lv 8 | 83 / 92 / 71% | 86 / 90 / 53% |
| Coast at Lv 15, in rain | 92 / 52 / 74% | 98 / 67 / 78% |
| Marsh at Lv 20 | 83 / 93 / 93% | 84 / 93 / 93% |
| Brook Head, Lv 9 Charmander, clear / rain | 70% / 51% | 62% / 50% |
| Hunter's last rung, health left on a win: clear / chip weather / rain / sun | 55 / 50 / 46 / 58% | 63 / 58 / 56 / 65% |

Heal pricing needs no change: every price is a share of a full bar, priced in
raid time, so it does not depend on how big HP is.

Weather's choices hold. Rain is still the only weather a place has, the
chipping weathers still cost the hunter fight and sun still gives. Every gap
is narrower: Brook Head's rain is now the largest a wild fight pays, not one it
decides.

## Left as they are, on purpose or for the captain

- **Speed ties** go to the player's side, so seeded measurements replay; FireRed flips a coin.
- **Escape odds** are capped at certain, where FireRed's `u8` wraps and makes the next try worse.
- **Ordinary trainers and hunters** pick moves at random; the gyms play FireRed's AI scripts.
- **Growl, Poison Powder and Sing** keep the Unity original's PP (30, 20, 20 to FireRed's 40, 35, 15). The code calls shorter PP a raid-game choice; Sing's is longer.
- **Encounter rates** are authored per place.
- **The Life Orb** is the game's own gear, applied last.
