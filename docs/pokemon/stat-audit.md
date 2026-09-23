# Base stat audit - FireRed/LeafGreen, all 151

The captain's ruling of 2026-09-23: no Pokemon stat is written from memory, and
every one of them has to be right.

## How the stats are checked

`node tools/species/verifyStats.mjs` reads each species' six base stats from
three independent sources, and its typing from two of them:

| Source | What it is | Pinned to |
| --- | --- | --- |
| [pret/pokefirered](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/src/data/pokemon/species_info.h) | the FireRed disassembly - the stat table the cartridge itself reads | commit `c75f352` |
| [Bulbapedia](https://bulbapedia.bulbagarden.net/w/index.php?oldid=4487482) | "List of Pokemon by base stats in Generations II-V" | revision 4487482 |
| [PokeAPI](https://pokeapi.co/api/v2/pokemon/25) | modern `stats` read back through `past_stats` (types through `past_types`) | read live |

If any source disagrees with another on any row, the script writes nothing.
On 2026-09-23 **all three agreed on every stat of all 151, and pret and PokeAPI
agreed on every typing.** The result is `tools/species/frlg-base-stats.json`.
`speciesImport.test.ts` holds every species the game fields to that file, and
`tools/species/generate.mjs` will not generate anything from a snapshot that
disagrees with it. `node tools/species/verifyStats.mjs --check` asks all three
sources again.

## What was wrong before

`statCorrections.ts` held 20 values written from recall, for the stats a later
generation raised. All 20 were right. What recall **missed** is the problem
with recall:

| Species | Stat | Was fielding | FireRed | Why |
| --- | --- | --- | --- | --- |
| Dugtrio | Attack | 100 | **80** | raised in generation VII; nobody remembered it |
| Butterfree | Sp. Atk | 90 | **80** | shipped on the generation VI value on purpose |
| Pikachu | Defense | 40 | **30** | shipped on the generation VI value on purpose |
| Pikachu | Sp. Def | 50 | **40** | shipped on the generation VI value on purpose |
| Jigglypuff | Sp. Def | 20 | **25** | a typo carried over from the Unity project |

The last four were kept by `shippedSpecies.ts` so that the starting maps and
the hunter ladder would not change. The captain has now ruled that the stats
must be correct, so they are gone, and `shippedSpecies.ts` can no longer hold a
stat at all - it only has room for learnsets.

Twenty species have a modern stat line that differs from FireRed's:
Butterfree, Beedrill, Pidgeot, Arbok, Pikachu, Raichu, Nidoqueen, Nidoking,
Clefable, Wigglytuff, Vileplume, Dugtrio, Poliwrath, Alakazam, Victreebel,
Golem, Farfetch'd, Dodrio, Electrode and Exeggutor. A number from a modern fan
site is wrong for this game for all of them.

## Did the balance move?

Barely. At the levels this game is played at, a stat is
`floor(base * level / 100) + 5`, so ten base points is one point of real stat
at level 10. The same seeded measurements were run on `main` and on this
change, **2000 fights a cell** so that a shift is a shift and not noise
(`tools/trainers/report.mts -- --trials=2000`,
`tools/abilities/measure.mts -- --trials=2000`). Dugtrio is on no wild table
and in no trainer's party, so its correction changes nothing yet.

**Trainers** (win rate for each test party, best move every turn, no items).
Every cell that moved:

| Trainer | Party | Before | After |
| --- | --- | --- | --- |
| Warden Wren | Bulbasaur 14 | 58% | 65% |
| Warden Holt (double battle) | three at 10-12 (includes the player's Butterfree) | 77% | 73% |
| Lookout Pell | Charmander 10 | 25% | 21% |
| Lookout Pell | Bulbasaur 14 | 56% | 59% |
| Drover Ash | Charmander 10 | 94% | 91% |
| Sluice Keeper Dane | Bulbasaur 14 | 93% | 95% |
| Miller Vance | Charmander 10 | 4% | 2% |

Everything else moved by two points or less, or not at all. The boss ladder's
order (Briggs, Wren, Vance, Pell, Dane, Holt) is unchanged and
`trainerLadder.test.ts` still passes.

**The hunter** (every rung against a party of three at its level plus one):
identical to the point before and after - 100% won on every rung, leaving the
party 75%, 53%, 46% and 42% of its health.

**Wild fights**: of 59 district tables times three starters, three cells moved and
none by more than one point (Deep Stand, Warden's Cut and the Sawpit in
Viridian Forest).

No species' correction shifts balance noticeably. The two worth knowing about
are both bosses. **Warden Wren** is seven points easier for a Bulbasaur:
her Pikachu now has FireRed's 30 Defense and 40 Sp. Def rather than a later
generation's 40 and 50, which outweighs her Jigglypuff's Sp. Def going up from
a typo's 20 to 25. **Warden Holt** is four points harder for the test party of
three: both sides field a Butterfree and both now attack from FireRed's 80
Sp. Atk rather than 90, and the player's is the one that had more fighting to
do.
